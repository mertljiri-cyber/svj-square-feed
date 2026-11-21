// Synthetic, in-memory stand-in for the database RPCs and private release bucket used by ask-house.
// It mirrors the SQL contract of 20261121180000_house_file_releases.sql; it is not an authorization boundary.
import { createHash } from 'node:crypto';
import { noteObjectPath, type Release } from '../../functions/ask-house/file-wiki';
import type { Source } from '../../functions/ask-house/core';
import type { Backend } from '../../functions/ask-house/handler';
import { buildRelease } from './fileWikiRelease';

export const ORG_A = '00000000-0000-4000-8000-00000000000a';
export const ORG_B = '00000000-0000-4000-8000-00000000000b';
export const RELEASE_1 = '00000000-0000-4000-8000-000000000101';
export const RELEASE_2 = '00000000-0000-4000-8000-000000000102';
const bytes = (s: string) => new TextEncoder().encode(s);
export const sha = (s: string | Uint8Array) => createHash('sha256').update(s).digest('hex');

export function fileWikiWorld() {
  const objects = new Map<string, Uint8Array>();
  const members = new Map<string, string>([['owner-a', ORG_A], ['owner-b', ORG_B]]);
  const state = new Map<string, Release | {id: null; manifest_sha256: null}>();
  const legacy: Source[] = [];
  const reads: string[] = [];
  const failures = new Set<string>();

  function publish(org: string, release: string, notes: Record<string, string>, unlisted: Record<string, string> = {}, version: 1 | 2 = 2) {
    const built = buildRelease(notes, {version});
    const root = `${org}/releases/${release}/`;
    for (const [key, data] of built.objects) objects.set(root + key, data);
    for (const [p, t] of Object.entries(unlisted)) objects.set(root + noteObjectPath(p), bytes(t));
    return {id: release, manifest_sha256: built.manifest_sha256};
  }
  const activate = (org: string, release: Release) => state.set(org, release);
  const tombstone = (org: string) => state.set(org, {id: null, manifest_sha256: null});

  function connect(token: string): Backend {
    const member = (org: unknown) => members.get(token) === org;
    const denied = {data: null, error: {code: 'PT403'}};
    return {
      identify: async () => members.has(token) || token === 'outsider',
      async rpc(name, args) {
        if (failures.has(name)) return {data: null, error: {code: 'XX000'}};
        if (name === 'consume_house_question' || name === 'consume_house_citation') return member(args.p_organization_id) ? {data: null, error: null} : denied;
        if (name === 'get_house_file_release') return member(args.p_org) ? {data: state.get(args.p_org as string) ?? null, error: null} : denied;
        if (name === 'read_house_markdown') {
          if (!member(args.p_org) || state.has(args.p_org as string)) return {data: [], error: null};
          const ids = args.p_ids as string[] | undefined;
          const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
          return {data: legacy.filter(s => ids ? ids.includes(s.id) : (args.p_terms as string[]).some(t => fold(s.body).includes(fold(t)))), error: null};
        }
        return {data: null, error: {code: '42883'}};
      },
      async readRelease(key) {
        reads.push(key);
        const data = objects.get(key);
        if (!data) throw new Error('missing');
        return new Uint8Array(data) as Uint8Array<ArrayBuffer>;
      },
    };
  }
  return {objects, members, state, legacy, reads, failures, publish, activate, tombstone, connect};
}

export function post(body: unknown, token = 'owner-a') {
  return new Request('https://functions.invalid/ask-house', {
    method: 'POST', headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}, body: JSON.stringify(body),
  });
}
