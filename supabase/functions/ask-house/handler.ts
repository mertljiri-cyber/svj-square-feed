// Runtime-independent request handler for ask-house. index.ts only wires Deno env, supabase-js and the model.
// Every authorization decision is made by the database under the caller's token; the service key is used
// solely by `readRelease` for immutable objects whose release the caller's token has just confirmed.
import { answerQuestion, queryVariants, type Source } from './core.ts';
import { createFileWiki, RELEASE_BUCKET, type Release } from './file-wiki.ts';

export type RpcResult = { data: unknown; error: { code?: string } | null };
export type Backend = {
  /** True only for a valid, non-anonymous user token. */
  identify: () => Promise<boolean>;
  /** RPC executed with the caller's token (never the service key). */
  rpc: (name: string, args: Record<string, unknown>) => Promise<RpcResult>;
  /** Reads one object of the private release bucket; must throw on any failure. */
  readRelease: (key: string, maxBytes: number) => Promise<Uint8Array<ArrayBuffer>>;
};
export type Generate = (question: string, sources: Source[]) => Promise<unknown>;
export type HandlerDeps = {
  enabled: boolean;
  /** null = backend not configured. */
  connect: (token: string) => Backend | null;
  /** null = model not configured; citation opens still work. */
  generate: Generate | null;
};

const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'POST, OPTIONS','Cache-Control':'no-store'};
const reply = (status: number, body: unknown) => Response.json(body, {status, headers});
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/;
const digest = /^[0-9a-f]{64}$/;
const legacyCitation = /^[a-z0-9-]{1,80}:[0-9a-f]{64}:[1-9][0-9]{0,5}$/;
const MAX_BODY = 4096;

class Forbidden extends Error {}
const statusOf = (code?: string) => code === 'PT429' ? 429 : code === 'PT403' ? 403 : code === 'PT401' ? 401 : 503;

type Store = {
  search: (question: string) => Promise<Source[]>;
  recheck: (ids: string[]) => Promise<Source[]>;
  open: (id: string) => Promise<Source | null>;
};
const EMPTY: Store = { search: async () => [], recheck: async () => [], open: async () => null };

/** SQL NULL = never configured (legacy store), {id:null} = tombstone, otherwise one exact release. Anything else throws. */
async function releaseState(backend: Backend, org: string): Promise<Release | 'tombstone' | null> {
  const {data, error} = await backend.rpc('get_house_file_release', {p_org: org});
  if (error) { if (error.code === 'PT403') throw new Forbidden(); throw new Error('release-state'); }
  if (data === null) return null;
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('release-state');
  const {id, manifest_sha256: sha} = data as Record<string, unknown>;
  if (id === null && sha === null) return 'tombstone';
  if (typeof id === 'string' && uuid.test(id) && typeof sha === 'string' && digest.test(sha)) return {id, manifest_sha256: sha};
  throw new Error('release-state');
}

function legacyRows(data: unknown): Source[] {
  if (data === null) return [];
  if (!Array.isArray(data) || data.length > 5) throw new Error('legacy');
  return data.map(row => {
    const r = row as Record<string, unknown>;
    if (!r || ['id','note_key','revision','section','body','title'].some(k => typeof r[k] !== 'string')) throw new Error('legacy');
    return {id: r.id, note_key: r.note_key, revision: r.revision, section: r.section, body: r.body, title: r.title} as Source;
  });
}

function legacyStore(backend: Backend, org: string): Store {
  const recheck = async (ids: string[]) => {
    const valid = ids.filter(id => legacyCitation.test(id)).slice(0, 5);
    if (!valid.length) return [];
    const {data, error} = await backend.rpc('read_house_markdown', {p_org: org, p_terms: [], p_ids: valid});
    if (error) throw new Error('legacy');
    return legacyRows(data).filter(s => valid.includes(s.id));
  };
  return {
    async search(question) {
      const terms = queryVariants(question);
      if (!terms.length) return [];
      const {data, error} = await backend.rpc('read_house_markdown', {p_org: org, p_terms: terms});
      if (error) throw new Error('legacy');
      return legacyRows(data);
    },
    recheck,
    open: async id => (await recheck([id])).find(s => s.id === id) ?? null,
  };
}

async function storeFor(backend: Backend, org: string): Promise<Store> {
  const state = await releaseState(backend, org);
  if (state === null) return legacyStore(backend, org);
  if (state === 'tombstone') return EMPTY;
  return createFileWiki(org, state, {
    read: backend.readRelease,
    // A revoked membership or any lookup failure makes the release inactive (fail closed).
    active: async () => {
      try { const now = await releaseState(backend, org); return now && now !== 'tombstone' ? now : null; }
      catch { return null; }
    },
  });
}

async function readBody(req: Request): Promise<unknown> {
  const reader = req.body?.getReader();
  if (!reader) return undefined;
  const decoder = new TextDecoder('utf-8', {fatal: true});
  let bytes = 0, raw = '';
  while (true) {
    const {done, value} = await reader.read();
    if (done) break;
    bytes += value.length;
    if (bytes > MAX_BODY) { await reader.cancel(); throw new RangeError('size'); }
    raw += decoder.decode(value, {stream: true});
  }
  return JSON.parse(raw + decoder.decode());
}

type Input = { org: string; question: string } | { org: string; citation: string };
function parseInput(input: unknown): Input | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;
  const {organization_id: org, question, citation_id: citation} = input as Record<string, unknown>;
  if (typeof org !== 'string' || !uuid.test(org)) return null;
  if (citation !== undefined) {
    if (question !== undefined || typeof citation !== 'string' || citation.length < 1 || citation.length > 200) return null;
    return {org, citation};
  }
  const q = typeof question === 'string' ? question.trim().normalize('NFC') : '';
  return q.length >= 3 && q.length <= 400 ? {org, question: q} : null;
}

export function createAskHouseHandler(deps: HandlerDeps) {
  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response(null, {status: 204, headers});
    if (req.method !== 'POST') return reply(405, {error: 'method'});
    const token = req.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/i)?.[1];
    if (!token) return reply(401, {error: 'login'});
    if (!deps.enabled) return reply(503, {error: 'not-configured'});
    let input: Input | null;
    try { input = parseInput(await readBody(req)); }
    catch (e) { return reply(e instanceof RangeError ? 413 : 400, {error: 'input'}); }
    if (!input) return reply(400, {error: 'input'});
    const generate = deps.generate;
    if ('question' in input && !generate) return reply(503, {error: 'not-configured'});
    const backend = deps.connect(token);
    if (!backend) return reply(503, {error: 'not-configured'});
    try {
      if (!await backend.identify()) return reply(401, {error: 'login'});
      const quota = await backend.rpc('citation' in input ? 'consume_house_citation' : 'consume_house_question', {p_organization_id: input.org});
      if (quota.error) return reply(statusOf(quota.error.code), {error: 'unavailable'});
      const store = await storeFor(backend, input.org);
      if ('citation' in input) return reply(200, {source: await store.open(input.citation)});
      return reply(200, await answerQuestion(input.question, {search: store.search, recheck: store.recheck, generate: generate!}));
    } catch (e) {
      if (e instanceof Forbidden) return reply(403, {error: 'unavailable'});
      return reply(503, {error: 'unavailable'});
    }
  };
}

const releaseKey = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/releases\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/(?:manifest\.json|index\/[0-9a-f]{2}\.json|notes\/(?:[0-9a-f]{2,200}\/){0,32}[0-9a-f]{2,200}\.md)$/;

/** Bounded, redirect-free download of one private release object with a server-only key. */
export function createReleaseReader(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch) {
  return async (key: string, maxBytes: number): Promise<Uint8Array<ArrayBuffer>> => {
    if (!releaseKey.test(key)) throw new Error('key');
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/storage/v1/object/authenticated/${RELEASE_BUCKET}/${key}`, {
      headers: {Authorization: `Bearer ${serviceKey}`, apikey: serviceKey}, redirect: 'error',
    });
    if (!res.ok || !res.body) { await res.body?.cancel(); throw new Error('storage'); }
    const reader = res.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) { await reader.cancel(); throw new Error('size'); }
      chunks.push(value);
    }
    const out = new Uint8Array(new ArrayBuffer(total));
    let offset = 0;
    for (const c of chunks) { out.set(c, offset); offset += c.length; }
    return out;
  };
}
