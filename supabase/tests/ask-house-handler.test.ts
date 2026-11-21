import { webcrypto } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { createAskHouseHandler, createReleaseReader, type Generate } from '../functions/ask-house/handler';
import type { Source } from '../functions/ask-house/core';
import { sameCitation } from '../../src/features/citationContract';
import { CANDIDATES, LINK_LOADS } from '../functions/ask-house/file-wiki';
import { fileWikiWorld, ORG_A, ORG_B, post, RELEASE_1, RELEASE_2 } from './helpers/fileWikiWorld';
import { LARGE_QUESTION, largeVault, LATE } from './helpers/fileWikiRelease';

vi.stubGlobal('crypto', webcrypto);
type Answer = {kind: 'answer'; claims: {text: string; citations: number[]}[]; sources: (Source & {number: number})[]};

const NOTES = {
  'Rada/Výtah.md': '# Výtah\n## Stav\nVýtah čeká na výměnu lan. Viz [[Finance/Rozpočet#Opravy]] a [zápis](../Zápisy/Schůze%202026.md).',
  'Finance/Rozpočet.md': '# Rozpočet\n## Opravy\nNa opravy je vyčleněno 350 000 Kč.',
  'Zápisy/Schůze 2026.md': '# Schůze 2026\nShromáždění schválilo dodavatele.',
};
const citeAll: Generate = async (_q, sources) => ({kind: 'answer', claims: [{text: 'Syntetická odpověď.', citations: sources.map((_, i) => i + 1)}]});

function setup(opts: {generate?: Generate | null; enabled?: boolean} = {}) {
  const w = fileWikiWorld();
  const r1 = w.publish(ORG_A, RELEASE_1, NOTES, {'Rada/Soukromé.md': 'Výtah: soukromá smlouva.'});
  w.activate(ORG_A, r1);
  const handle = createAskHouseHandler({enabled: opts.enabled ?? true, generate: opts.generate === undefined ? citeAll : opts.generate, connect: w.connect});
  const call = async (body: unknown, token?: string) => { const res = await handle(post(body, token)); return {status: res.status, body: await res.json()}; };
  const ask = async (token?: string, org = ORG_A) => call({organization_id: org, question: 'Jaký je stav výtahu?'}, token);
  const open = async (citation_id: unknown, token?: string, org = ORG_A) => call({organization_id: org, citation_id}, token);
  return {w, r1, handle, call, ask, open};
}

describe('ask-house endpoint with the file release backend', () => {
  it('answers from the active release, follows links and opens every citation under the frontend contract', async () => {
    const t = setup();
    const {status, body} = await t.ask();
    expect(status).toBe(200);
    const answer = body as Answer;
    expect(answer.kind).toBe('answer');
    expect(answer.sources.map(s => s.path)).toEqual(['Rada/Výtah.md', 'Finance/Rozpočet.md', 'Zápisy/Schůze 2026.md']);
    expect(answer.sources[1].section).toBe('Opravy');
    expect(t.w.reads.every(k => k.startsWith(`${ORG_A}/releases/${RELEASE_1}/`))).toBe(true);
    expect(t.w.reads.some(k => k.includes('536f756b726f6d'))).toBe(false); // hex("Soukrom…") never read
    for (const cited of answer.sources) {
      const opened = await t.open(cited.id);
      expect(opened.status).toBe(200);
      expect(Object.keys(opened.body)).toEqual(['source']);
      expect(sameCitation(opened.body.source, cited)).toBe(true);
    }
  });

  it('revokes citations and answers on a tombstone and on a replacement release (fail closed)', async () => {
    const t = setup();
    const [first] = ((await t.ask()).body as Answer).sources;
    t.w.activate(ORG_A, t.w.publish(ORG_A, RELEASE_2, NOTES));
    expect(await t.open(first.id)).toEqual({status: 200, body: {source: null}});
    const second = ((await t.ask()).body as Answer).sources[0];
    expect(second.id).toContain(RELEASE_2);
    t.w.tombstone(ORG_A);
    expect(await t.open(second.id)).toEqual({status: 200, body: {source: null}});
    expect(await t.ask()).toEqual({status: 200, body: {kind: 'unknown'}});
  });

  it('withdraws an answer when the release is revoked during generation', async () => {
    const ref: {world?: ReturnType<typeof fileWikiWorld>} = {};
    const t = setup({generate: async (q, s) => { ref.world?.tombstone(ORG_A); return citeAll(q, s); }});
    ref.world = t.w;
    expect(await t.ask()).toEqual({status: 200, body: {kind: 'unknown'}});
  });

  it('answers from a late file of a >160-note indexed release without downloading the corpus', async () => {
    const t = setup();
    const notes = largeVault(230);
    t.w.activate(ORG_A, t.w.publish(ORG_A, RELEASE_2, notes));
    t.w.reads.length = 0;
    const {status, body} = await t.call({organization_id: ORG_A, question: LARGE_QUESTION});
    expect(status).toBe(200);
    const answer = body as Answer;
    expect(answer.sources[0]).toMatchObject({path: LATE, section: 'Stav'});
    expect(answer.sources.map(s => s.path)).toContain('Zápisy/Rozpočet.md');
    // search (manifest + ≤8 shards + notes) + post-generation recheck (fresh manifest + ≤5 cited notes)
    expect(t.w.reads.length).toBeLessThanOrEqual(1 + 8 + CANDIDATES + LINK_LOADS + 1 + 5);
    expect(t.w.reads.length).toBeLessThan(Object.keys(notes).length / 10);
    for (const cited of answer.sources) {
      const opened = await t.open(cited.id);
      expect(sameCitation(opened.body.source, cited)).toBe(true);
    }
    // A tampered index shard fails closed (503), it is never skipped or replaced by a full scan.
    const shard = [...t.w.objects.keys()].find(k => k.startsWith(`${ORG_A}/releases/${RELEASE_2}/index/`) && new TextDecoder().decode(t.w.objects.get(k)).includes('"vytahu"'))!;
    t.w.objects.set(shard, new TextEncoder().encode(new TextDecoder().decode(t.w.objects.get(shard)).replace('"vytahu"', '"vytahy"')));
    expect((await t.call({organization_id: ORG_A, question: LARGE_QUESTION})).status).toBe(503);
  });

  it('still serves a v1 pilot release', async () => {
    const t = setup();
    t.w.activate(ORG_A, t.w.publish(ORG_A, RELEASE_2, NOTES, {}, 1));
    const answer = (await t.ask()).body as Answer;
    expect(answer.sources.map(s => s.path)).toEqual(['Rada/Výtah.md', 'Finance/Rozpočet.md', 'Zápisy/Schůze 2026.md']);
    expect(t.w.reads.some(k => k.includes('/index/'))).toBe(false);
  });

  it('keeps each SVJ separate', async () => {
    const t = setup();
    const [cited] = ((await t.ask()).body as Answer).sources;
    expect((await t.open(cited.id, 'owner-b')).status).toBe(403);
    expect((await t.ask('owner-b')).status).toBe(403);
    t.w.activate(ORG_B, t.w.publish(ORG_B, RELEASE_2, NOTES));
    t.w.reads.length = 0;
    expect(await t.open(cited.id, 'owner-b', ORG_B)).toEqual({status: 200, body: {source: null}});
    expect(t.w.reads.some(k => k.startsWith(ORG_A))).toBe(false);
    expect((await t.open(cited.id, 'outsider')).status).toBe(403);
    t.w.members.delete('owner-a');
    expect((await t.open(cited.id, 'owner-a')).status).toBe(401);
  });

  it('fails closed on lookup errors, tampering, quota and malformed input', async () => {
    const t = setup();
    const [cited] = ((await t.ask()).body as Answer).sources;
    t.w.failures.add('get_house_file_release');
    expect((await t.open(cited.id)).status).toBe(503);
    expect((await t.ask()).status).toBe(503);
    t.w.failures.clear();
    const key = `${ORG_A}/releases/${RELEASE_1}/manifest.json`;
    const manifest = t.w.objects.get(key)!;
    t.w.objects.set(key, new TextEncoder().encode(new TextDecoder().decode(manifest).replace('Rada', 'Rady')));
    expect((await t.open(cited.id)).status).toBe(503);
    t.w.objects.set(key, manifest);
    expect((await t.open(cited.id)).body.source?.id).toBe(cited.id);
    t.w.failures.add('consume_house_citation');
    expect((await t.open(cited.id)).status).toBe(503);
    for (const body of [
      {organization_id: ORG_A, question: 'Výtah?', citation_id: cited.id},
      {organization_id: ORG_A, citation_id: 7},
      {organization_id: ORG_A, citation_id: ''},
      {organization_id: ORG_A.toUpperCase(), question: 'Výtah?'},
      {organization_id: ORG_A, question: 'ab'},
      [ORG_A],
    ]) expect((await t.call(body)).status).toBe(400);
    expect((await t.call({organization_id: ORG_A, question: 'x'.repeat(5000)})).status).toBe(413);
    expect((await t.handle(new Request('https://functions.invalid/', {method: 'POST', body: '{}'}))).status).toBe(401);
    expect((await t.handle(new Request('https://functions.invalid/', {method: 'GET'}))).status).toBe(405);
  });

  it('serves citation opens without a configured model, and nothing when disabled', async () => {
    const t = setup({generate: null});
    expect((await t.ask()).status).toBe(503);
    expect(await t.open(`file:${RELEASE_1}:${'0'.repeat(64)}:1`)).toEqual({status: 200, body: {source: null}});
    expect((await setup({enabled: false}).open('x')).status).toBe(503);
  });

  it('keeps the legacy database store working until a release is configured', async () => {
    const t = setup();
    t.w.state.delete(ORG_A);
    const legacy = {id: `vytah:${'b'.repeat(64)}:3`, note_key: 'vytah', revision: 'b'.repeat(64), section: 'Stav', title: 'Výtah', body: 'Výtah čeká na servis.'};
    t.w.legacy.push(legacy);
    const answer = (await t.ask()).body as Answer;
    expect(answer.sources).toEqual([{number: 1, id: legacy.id, note_key: 'vytah', revision: legacy.revision, section: 'Stav', title: 'Výtah'}]);
    const opened = await t.open(legacy.id);
    expect(sameCitation(opened.body.source, answer.sources[0])).toBe(true);
    expect(await t.open(`file:${RELEASE_1}:${'0'.repeat(64)}:1`)).toEqual({status: 200, body: {source: null}});
    t.w.tombstone(ORG_A);
    expect(await t.open(legacy.id)).toEqual({status: 200, body: {source: null}});
  });
});

describe('release object reader', () => {
  const key = `${ORG_A}/releases/${RELEASE_1}/notes/52616461/5ac3a170697320412e6d64.md`;
  it('only fetches release object keys from the authenticated storage endpoint and bounds the size', async () => {
    const fetchImpl = vi.fn(async () => new Response('123456'));
    const read = createReleaseReader('https://db.invalid/', 'service', fetchImpl as unknown as typeof fetch);
    for (const bad of [`${ORG_A}/releases/${RELEASE_1}/../x.md`, `${ORG_A}/other/manifest.json`, `${ORG_A}/releases/${RELEASE_1}/notes/Rada.md`,
      `${ORG_A}/releases/${RELEASE_1}/index/0a.md`, `${ORG_A}/releases/${RELEASE_1}/index/100.json`])
      await expect(read(bad, 100)).rejects.toThrow('key');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(new TextDecoder().decode(await read(`${ORG_A}/releases/${RELEASE_1}/index/0a.json`, 6))).toBe('123456');
    fetchImpl.mockClear();
    expect(new TextDecoder().decode(await read(key, 6))).toBe('123456');
    expect(fetchImpl).toHaveBeenCalledWith(`https://db.invalid/storage/v1/object/authenticated/svj-wiki-releases/${key}`, expect.objectContaining({redirect: 'error'}));
    await expect(read(key, 5)).rejects.toThrow('size');
    fetchImpl.mockResolvedValueOnce(new Response('missing', {status: 404}));
    await expect(read(key, 100)).rejects.toThrow('storage');
  });
});
