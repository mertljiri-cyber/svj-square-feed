import { queryVariants, type Source } from './core.ts';

export const RELEASE_BUCKET = 'svj-wiki-releases';
// Every release object (note, manifest, index shard) fits the bucket's 64 KiB file_size_limit.
const FILE_LIMIT = 65536;
// v1 = pilot format: every note is read on every question. v2 = manifest-bound term index (see below).
const V1 = { files: 64, total: 2 * 1024 * 1024 };
const V2 = { files: 256, total: 8 * 1024 * 1024 };
const MAX_SHARDS = 64;
// v2 per-question bound, independent of corpus size: manifest + ≤1 shard per term (≤8, queryVariants)
// + CANDIDATES original notes + LINK_LOADS link targets that were not already candidates.
export const CANDIDATES = 6;
export const LINK_LOADS = 4;
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const hex = (bytes: Uint8Array) => Array.from(bytes, n => n.toString(16).padStart(2, '0')).join('');
const sha256 = async (bytes: Uint8Array<ArrayBuffer>) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)));
const uuidPattern = '[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}';
const uuid = new RegExp(`^${uuidPattern}$`);
const digest = /^[0-9a-f]{64}$/;
const citation = new RegExp(`^file:(${uuidPattern}):([0-9a-f]{64}):([1-9][0-9]{0,4})$`);

export type Release = { id: string; manifest_sha256: string };
export type ReleaseState = Release | { id: null; manifest_sha256: null } | null;
type Entry = { path: string; sha256: string; bytes: number; key: string };
type Pinned = { sha256: string; bytes: number };
type Manifest = { files: Entry[]; shards: Pinned[] | null };
type FileSource = Source & { path: string };
type Note = { passages: FileSource[]; links: Link[] };
type Link = { raw: string; wiki: boolean };

// Reversible ASCII encoding per segment: the hierarchy and exact (case-sensitive) filenames survive.
// The trailing `.md` lets upload tools infer text/markdown, the only note MIME type the bucket accepts.
// Mirrored by scripts/wiki-release-import.py (object_path); both tests pin the same literal.
export function noteObjectPath(path: string) {
  return 'notes/' + path.split('/').map(s => hex(encoder.encode(s))).join('/') + '.md';
}
function validPath(path: string) {
  return path === path.normalize('NFC') && path.endsWith('.md') && encoder.encode(path).length <= 360 &&
    !/[\\%:#?[\]|<>\p{C}�]/u.test(path) && path.split('/').every(s => s.length && !s.startsWith('.') && s === s.trim() && encoder.encode(s).length <= 100);
}

const folded = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
const wordPattern = /[\p{L}\p{N}][\p{L}\p{N}-]*/gu;

// ---- Derived term index (v2). Mirrored by scripts/wiki-release-import.py; both tests pin the same vectors.
// It only NOMINATES candidate notes; every passage, score and citation still comes from a verified original.
/** FNV-1a 32-bit over UTF-8. */
export function fnv1a(s: string) {
  let h = 0x811c9dc5;
  for (const b of encoder.encode(s)) h = Math.imul(h ^ b, 0x01000193) >>> 0;
  return h;
}
/** Folded words of ≥3 code points, as matched by the passage scorer (`word.startsWith(term)`). */
export const indexWords = (text: string) => new Set((folded(text).match(wordPattern) ?? []).filter(w => Array.from(w).length >= 3));
/** Shard of a word or query term: every word starting with a term shares its first 3 code points. */
export const indexShard = (word: string, shards: number) => fnv1a(Array.from(word).slice(0, 3).join('')) % shards;
export const indexKey = (shard: number) => `index/${shard.toString(16).padStart(2, '0')}.json`;

function parseShard(text: string, shard: number, shards: number, files: number) {
  const value = JSON.parse(text);
  if (value?.version !== 2 || value.shard !== shard || !Array.isArray(value.words)) throw new Error('index');
  return (value.words as unknown[]).map(row => {
    if (!Array.isArray(row) || row.length !== 2) throw new Error('index');
    const [word, list] = row as [unknown, unknown];
    if (typeof word !== 'string' || Array.from(word).length < 3 || indexShard(word, shards) !== shard ||
      !Array.isArray(list) || !list.length || list.length > files) throw new Error('index');
    let last = -1;
    for (const f of list) {
      if (!Number.isInteger(f) || f <= last || f >= files) throw new Error('index');
      last = f;
    }
    return [word, list as number[]] as const;
  });
}

const anchorKey = (s: string) => folded(s).trim().replace(/[^\p{L}\p{N} _-]/gu, '').replace(/\s+/gu, '-');
const linkPattern = /\[\[([^\]\n]+)\]\]|(?<!!)\[[^\]\n]*\]\(\s*(?:<([^>\n]+)>|([^\s)]+))(?:\s+"[^"\n]*")?\s*\)/gu;
const withoutCode = (line: string) => line.replace(/(`+).*?\1/g, '');
const linksIn = (line: string): Link[] => Array.from(withoutCode(line).matchAll(linkPattern), m => ({ raw: m[1] ?? m[2] ?? m[3], wiki: m[1] !== undefined }));
function parseNote(text: string, entry: Entry, release: Release): Note {
  const lines = text.split(/\r\n?|\n/);
  let frontmatter = lines[0]?.trim() === '---';
  let fence = '';
  let title = entry.path.split('/').at(-1)!.slice(0, -3), section = '';
  const rows: Array<{ line: number; section: string; body: string }> = [];
  const links: Link[] = [];
  let seenH1 = false;
  for (const [i, raw] of lines.entries()) {
    const line = raw.trim();
    if (frontmatter) { if (i && /^(---|\.\.\.)$/.test(line)) frontmatter = false; continue; }
    const marker = line.match(/^(`{3,}|~{3,})/);
    if (fence) { if (marker && marker[0][0] === fence[0] && marker[0].length >= fence.length && line === marker[0]) fence = ''; continue; }
    if (marker) { fence = marker[0]; continue; }
    const heading = line.match(/^(#{1,6})\s+(.+?)\s*#*$/u);
    if (heading) {
      section = heading[2].slice(0, 240);
      if (!seenH1 && heading[1] === '#') { title = section; seenH1 = true; }
      continue;
    }
    if (links.length < 64) links.push(...linksIn(line.slice(0, 2400)).slice(0, 64 - links.length));
    if (/[\p{L}\p{N}]/u.test(line.replace(linkPattern, ''))) rows.push({ line: i + 1, section, body: line.slice(0, 2400) });
  }
  return { links, passages: rows.map(row => ({ id: `file:${release.id}:${entry.key}:${row.line}`, note_key: entry.key,
    revision: entry.sha256, path: entry.path, title, section: row.section || title, body: row.body })) };
}

function resolveLink(from: string, link: Link, paths: ReadonlyMap<string, Entry>, basenames: ReadonlyMap<string, string | null>) {
  const target = link.wiki ? link.raw.split('|', 1)[0] : link.raw;
  const hash = target.indexOf('#');
  let path = hash < 0 ? target : target.slice(0, hash);
  let fragment = hash < 0 ? '' : target.slice(hash + 1);
  try { path = decodeURIComponent(path).trim(); fragment = decodeURIComponent(fragment); } catch { return null; }
  if (!path || path.startsWith('/') || /[\\:?#%]/.test(path)) return null;
  if (link.wiki && !path.endsWith('.md')) path += '.md';
  if (!path.endsWith('.md')) return null;
  path = path.normalize('NFC');
  const normalize = (base: string[]) => {
    for (const part of path.split('/')) {
      if (!part) return null;
      if (part === '.') continue;
      if (part === '..') { if (!base.length) return null; base.pop(); }
      else base.push(part);
    }
    return base.join('/');
  };
  const local = normalize(from.split('/').slice(0, -1));
  if (local === null) return null;
  // Markdown is always relative. A qualified wikilink may also be vault-root relative.
  // Bare wiki names prefer the exact sibling, otherwise only a unique basename qualifies.
  const root = link.wiki && !path.startsWith('.') && path.includes('/') ? normalize([]) : null;
  const found = paths.has(local) ? local : root && paths.has(root) ? root :
    link.wiki && !path.includes('/') ? basenames.get(path) : null;
  return found ? { path: found, fragment } : null;
}

const validPinned = (b: unknown): b is Pinned => !!b && typeof b === 'object' && typeof (b as Pinned).sha256 === 'string' &&
  digest.test((b as Pinned).sha256) && Number.isInteger((b as Pinned).bytes) && (b as Pinned).bytes >= 1 && (b as Pinned).bytes <= FILE_LIMIT;

export function createFileWiki(org: string, release: Release, deps: {
  read: (key: string, maxBytes: number) => Promise<Uint8Array<ArrayBuffer>>;
  active: () => Promise<ReleaseState>;
}) {
  if (!uuid.test(org) || !uuid.test(release.id) || !digest.test(release.manifest_sha256)) throw new Error('release');
  const prefix = `${org}/releases/${release.id}/`;
  async function verified(key: string, sha: string, max: number, size?: number) {
    const data = await deps.read(prefix + key, max);
    if (data.length > max || (size !== undefined && data.length !== size) || await sha256(data) !== sha) throw new Error('integrity');
    return decoder.decode(data);
  }
  let manifest: Promise<Manifest> | undefined;
  function entries() {
    return manifest ??= (async () => {
      const value = JSON.parse(await verified('manifest.json', release.manifest_sha256, FILE_LIMIT));
      const limit = value?.version === 1 ? V1 : value?.version === 2 ? V2 : null;
      if (!limit || !Array.isArray(value.files) || value.files.length > limit.files) throw new Error('manifest');
      let total = 0;
      const paths = new Set<string>();
      const files: Entry[] = [];
      for (const f of value.files) {
        // Read path before validPinned narrows `f` to Pinned (which has no `path`).
        const path = f?.path;
        if (!f || typeof path !== 'string' || !validPath(path) || paths.has(path) || !validPinned(f) || (total += f.bytes) > limit.total) throw new Error('manifest');
        paths.add(path);
        files.push({ path, sha256: f.sha256, bytes: f.bytes, key: await sha256(encoder.encode(path)) });
      }
      if (limit === V1) return { files, shards: null };
      // The shard digests live in the manifest, whose digest the database pins: the index is bound to this release.
      const shards = value.index?.shards;
      if (!Array.isArray(shards) || !shards.length || shards.length > MAX_SHARDS || (shards.length & (shards.length - 1)) !== 0 ||
        !shards.every(validPinned)) throw new Error('manifest');
      return { files, shards: shards.map((s: Pinned) => ({ sha256: s.sha256, bytes: s.bytes })) };
    })();
  }
  async function stillActive() {
    const state = await deps.active();
    return state?.id === release.id && state.manifest_sha256 === release.manifest_sha256;
  }
  async function load(entry: Entry) {
    return parseNote(await verified(noteObjectPath(entry.path), entry.sha256, entry.bytes, entry.bytes), entry, release);
  }
  /** v1: every note. v2: the ≤CANDIDATES notes the index ranks highest (idf-weighted term matches), in manifest order. */
  async function candidates({ files, shards }: Manifest, terms: string[]) {
    if (!shards) return files;
    const byShard = new Map<number, string[]>();
    for (const t of terms) { const i = indexShard(t, shards.length); byShard.set(i, [...(byShard.get(i) ?? []), t]); }
    const rank = new Map<number, number>();
    await Promise.all([...byShard].map(async ([i, group]) => {
      const words = parseShard(await verified(indexKey(i), shards[i].sha256, shards[i].bytes, shards[i].bytes), i, shards.length, files.length);
      for (const t of group) {
        const hit = new Set<number>();
        for (const [w, list] of words) if (w.startsWith(t)) for (const f of list) hit.add(f);
        const idf = Math.log(1 + files.length / (hit.size || 1));
        for (const f of hit) rank.set(f, (rank.get(f) ?? 0) + idf);
      }
    }));
    return [...rank].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, CANDIDATES).sort((a, b) => a[0] - b[0]).map(([f]) => files[f]);
  }
  async function search(question: string): Promise<Source[]> {
    const terms = [...new Set(queryVariants(question).map(folded))];
    if (!terms.length || !await stillActive()) return [];
    const m = await entries();
    const paths = new Map(m.files.map(f => [f.path, f]));
    const basenames = new Map<string, string | null>();
    for (const { path } of m.files) {
      const name = path.split('/').at(-1)!;
      basenames.set(name, basenames.has(name) ? null : path);
    }
    const notes = new Map<string, Promise<Note>>();
    const note = (f: Entry) => { let n = notes.get(f.path); if (!n) notes.set(f.path, n = load(f)); return n; };
    const hits: { source: FileSource; score: number }[] = [];
    const count = (text: string) => {
      const words = folded(text).match(wordPattern) ?? [];
      return terms.reduce((n, term) => n + Number(words.some(w => w.startsWith(term))), 0);
    };
    const score = (s: FileSource) => 3 * count(s.body) + count(`${s.title} ${s.section} ${s.path}`);
    const pool = await candidates(m, terms);
    for (let i = 0; i < pool.length; i += 8) await Promise.all(pool.slice(i, i + 8).map(note));
    for (const f of pool) {
      for (const source of (await note(f)).passages) {
        const rank = score(source);
        if (rank) hits.push({ source, score: rank });
      }
    }
    hits.sort((a,b) => b.score - a.score);
    const direct: FileSource[] = [];
    const seen = new Set<string>();
    for (const { source } of hits) {
      if (!seen.has(source.path)) { direct.push(source); seen.add(source.path); }
      if (direct.length === 3) break;
    }
    const linked: FileSource[] = [];
    let loads = 0;
    for (const src of direct) {
      for (const link of [...linksIn(src.body), ...(await note(paths.get(src.path)!)).links]) {
        const dest = resolveLink(src.path, link, paths, basenames);
        if (!dest || seen.has(dest.path)) continue;
        if (!notes.has(dest.path)) { if (loads === LINK_LOADS) continue; loads++; }
        const fragment = anchorKey(dest.fragment);
        const passages = (await note(paths.get(dest.path)!)).passages.filter(s => !fragment || anchorKey(s.section) === fragment);
        if (!passages.length) continue;
        let best = passages[0], rank = score(best);
        for (const p of passages.slice(1)) { const n = score(p); if (n > rank) { best = p; rank = n; } }
        linked.push(best);
        seen.add(dest.path);
        if (linked.length === 2) break;
      }
      if (linked.length === 2) break;
    }
    const result = [...direct, ...linked, ...hits.map(h => h.source).filter(s => !seen.has(s.path) || direct.some(d => d.path === s.path))];
    return await stillActive() ? [...new Map(result.map(s => [s.id, s])).values()].slice(0, 5) : [];
  }
  async function recheck(ids: string[]): Promise<Source[]> {
    const matches = ids.slice(0, 5).map(id => [id, citation.exec(id)] as const).filter(([, m]) => m?.[1] === release.id);
    if (!matches.length || !await stillActive()) return [];
    // Use a fresh manifest read when validating output, not the search cache. Never touches the index.
    manifest = undefined;
    const files = new Map((await entries()).files.map(f => [f.key, f]));
    const notes = new Map<string, Promise<Note>>();
    const found = await Promise.all(matches.map(async ([id, m]) => {
      const file = files.get(m![2]);
      if (!file) return undefined;
      if (!notes.has(file.key)) notes.set(file.key, load(file));
      return (await notes.get(file.key))!.passages.find(s => s.id === id);
    }));
    return await stillActive() ? found.filter((s): s is FileSource => !!s) : [];
  }
  return { search, recheck, open: async (id: string) => (await recheck([id]))[0] ?? null };
}
