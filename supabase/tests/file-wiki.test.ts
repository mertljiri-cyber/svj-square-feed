import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { CANDIDATES, createFileWiki, fnv1a, indexKey, indexShard, indexWords, LINK_LOADS, noteObjectPath } from '../functions/ask-house/file-wiki';
import { answerQuestion } from '../functions/ask-house/core';
import { buildRelease, LARGE_QUESTION, largeVault, LATE, type Shard } from './helpers/fileWikiRelease';

const org = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000099';
const root = `${org}/releases/${id}/`;
const bytes = (s: string) => new TextEncoder().encode(s);
vi.stubGlobal('crypto', webcrypto);

function fixture(notes: Record<string,string>, unlisted: Record<string,string> = {}, opts: Parameters<typeof buildRelease>[1] = {}) {
  const built = buildRelease(notes, opts);
  const objects = new Map<string, Uint8Array>([...built.objects].map(([k, v]) => [root + k, v]));
  for (const [p, t] of Object.entries(unlisted)) objects.set(root + noteObjectPath(p), bytes(t));
  const release = { id, manifest_sha256: built.manifest_sha256 };
  let current: typeof release | null = release;
  const read = vi.fn(async (key: string) => { const data = objects.get(key); if (!data) throw Error('missing'); return data as Uint8Array<ArrayBuffer>; });
  const active = vi.fn(async () => current);
  const keys = () => read.mock.calls.map(([k]) => k.slice(root.length));
  return { objects, read, keys, active, revoke: () => { current = null; }, wiki: createFileWiki(org, release, { read, active }) };
}

it('pins the object layout and index vectors shared with scripts/wiki-release-import.py', () => {
  expect(noteObjectPath('Rada/Zápis A.md')).toBe('notes/52616461/5ac3a170697320412e6d64.md');
  expect([fnv1a('a'), fnv1a('abc')]).toEqual([0xe40c292c, 0x1a47e90b]);
  expect(indexShard('abcdef', 64)).toBe(11);
  expect(indexKey(10)).toBe('index/0a.json');
  expect([...indexWords('Výtah-A1 čeká; ab')].sort()).toEqual(['ceka', 'vytah-a1']);
});

describe.each([1, 2] as const)('release format v%i', version => {
  it('follows relative and wiki links to approved answers that have no query words', async () => {
    const f = fixture({
      'agenda/Start.md': '# Opravy\nVýtah má samostatné podklady.\n[Zápis](../rada/Z%C3%A1pis%20A.md#Stav) · [[finance/Rozpočet|plán]] · [[Souhrn]] · [[Neveřejné]] · [cizí](https://other.test/Secrets.md) · [mimo](../../Secrets.md)',
      'rada/Zápis A.md': '# Zápis\n## Stav\nDodavatel nastoupí v pondělí.',
      'finance/Rozpočet.md': '# Rozpočet\nČástka je 350 000 Kč.',
      'rada/Souhrn.md': 'Kolize nesmí být v kontextu.',
      'finance/Souhrn.md': 'Druhá kolize nesmí být v kontextu.',
    }, {'Neveřejné.md':'Výtah má soukromou smlouvu.'}, {version});
    const hits = await f.wiki.search('výtah');
    expect(hits.map(s => s.body)).toEqual(['Výtah má samostatné podklady.', 'Dodavatel nastoupí v pondělí.', 'Částka je 350 000 Kč.']);
    expect(hits[1]).toMatchObject({path:'rada/Zápis A.md', section:'Stav'});
    expect(f.read.mock.calls.every(([k]) => k.startsWith(root) && k !== root + noteObjectPath('Neveřejné.md'))).toBe(true);
    expect(await f.wiki.open(hits[1].id)).toEqual(hits[1]);
  });

  it('does not open arbitrary paths, other releases, tampered content or revoked citations', async () => {
    const f = fixture({'A.md':'Výtah má plánovanou opravu.'}, {}, {version});
    const [hit] = await f.wiki.search('výtah');
    f.read.mockClear();
    expect(await f.wiki.open('A.md')).toBeNull();
    expect(await f.wiki.open(hit.id.replace(id, org))).toBeNull();
    expect(f.read).not.toHaveBeenCalled();
    f.objects.set(root + noteObjectPath('A.md'), bytes('Výtah má plánovanou poruchu.'));
    await expect(f.wiki.open(hit.id)).rejects.toThrow('integrity');
    f.revoke();
    expect(await f.wiki.open(hit.id)).toBeNull();
  });

  it('discards a generated answer if the release is withdrawn during generation', async () => {
    const f = fixture({'A.md':'Výtah má plánovanou opravu.'}, {}, {version});
    expect(await answerQuestion('výtah', {
      search: f.wiki.search,
      generate: async () => { f.revoke(); return {kind:'answer',claims:[{text:'Oprava je v plánu.',citations:[1]}]}; },
      recheck: f.wiki.recheck,
    })).toEqual({kind:'unknown'});
  });
});

it('answers from a late file of a >160-note release with bounded reads, links and citations', async () => {
  const notes = largeVault(230);
  expect(Object.keys(notes).length).toBeGreaterThan(160);
  const f = fixture(notes);
  const hits = await f.wiki.search(LARGE_QUESTION);
  expect(hits[0]).toMatchObject({path: LATE, section: 'Stav'});
  expect(hits.map(s => s.path)).toEqual([LATE, 'Archiv/Poznámka 000.md', 'Archiv/Poznámka 010.md', 'Zápisy/Rozpočet.md', 'Archiv/Poznámka 042.md']);
  expect(hits[3]).toMatchObject({section: 'Částka', body: 'Na opravy je vyčleněno 350 000 Kč.'});
  const keys = f.keys();
  const noteReads = keys.filter(k => k.startsWith('notes/'));
  expect(new Set(keys).size).toBe(keys.length); // nothing read twice
  expect(keys.filter(k => k === 'manifest.json')).toHaveLength(1);
  expect(keys.filter(k => k.startsWith('index/')).length).toBeLessThanOrEqual(4); // 4 distinct term prefixes
  expect(noteReads.length).toBeLessThanOrEqual(CANDIDATES + LINK_LOADS);
  expect(noteReads).toContain(noteObjectPath(LATE));
  expect(noteReads).not.toContain(noteObjectPath('Archiv/Poznámka 229.md'));
  for (const hit of hits) {
    f.read.mockClear();
    expect(await f.wiki.open(hit.id)).toEqual(hit);
    expect(f.keys()).toEqual(['manifest.json', noteObjectPath(hit.path!)]); // citations never read the index
  }
});

it('treats the index only as a hint and fails closed when it does not match the release', async () => {
  const notes = {'A.md': 'Výtah má plánovanou opravu.', 'B.md': 'Úklid proběhl podle plánu.'};
  const rewrite = (to: number[]) => (shards: Shard[]) => { for (const s of shards) for (const row of s.words) if (row[0] === 'vytah') row[1] = to; };
  // A (hash-bound) index that nominates B: B is read and verified, but contributes nothing it does not contain.
  const hint = fixture(notes, {}, {tamper: rewrite([0, 1])});
  expect((await hint.wiki.search('výtah')).map(s => s.body)).toEqual(['Výtah má plánovanou opravu.']);
  expect(hint.keys()).toContain(noteObjectPath('B.md'));
  // Out-of-range posting, wrong shard number or swapped/tampered shard bytes: no answer at all.
  await expect(fixture(notes, {}, {tamper: rewrite([2])}).wiki.search('výtah')).rejects.toThrow('index');
  const k = indexShard('vytah', 8);
  await expect(fixture(notes, {}, {tamper: s => { s[k].shard = (k + 1) % 8; }}).wiki.search('výtah')).rejects.toThrow('index');
  const swapped = fixture(notes);
  const key = root + indexKey(indexShard('vytah', 8));
  swapped.objects.set(key, bytes(new TextDecoder().decode(swapped.objects.get(key)!).replace('"vytah",[0]', '"vytah",[1]')));
  await expect(swapped.wiki.search('výtah')).rejects.toThrow('integrity');
  // A manifest that is v2 but has no usable index is rejected, not silently scanned.
  const broken = fixture(notes, {}, {shards: 3});
  await expect(broken.wiki.search('výtah')).rejects.toThrow('manifest');
});
