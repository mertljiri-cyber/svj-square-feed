import { expect, it } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { answerQuestion, type Source } from '../functions/ask-house/core';

it('returns an exact server citation ID; reopening reads only that authorized current passage', async () => {
  const w = await buildWorld();
  try {
    await w.db.rpc(w.boardA, 'public.publish_house_markdown($1,$2,$3,$4)', [w.orgA, 'synteticke-opravy', 'Syntetické opravy', '## Zvonky\nVýměna zvonků byla schválena.\n\n## Jiné téma\nTento nesouvisející odstavec se v citaci neotevře.']);
    const read = (user: string, ids: string[] | null, org = w.orgA) => w.db.rpc<Source[]>(user, 'public.read_house_markdown($1,$2,$3)', [org, ids ? [] : ['zvonk'], ids]);
    const result = await answerQuestion('Co víme o zvoncích?', {
      search: () => read(w.ownerA, null),
      recheck: ids => read(w.ownerA, ids),
      generate: async () => ({kind: 'answer', claims: [{text: 'Výměna zvonků byla schválena.', citations: [1]}]}),
    });
    expect(result.kind).toBe('answer');
    if (result.kind !== 'answer') throw new Error('Expected grounded answer');
    expect(result.sources).toHaveLength(1);
    const citation = result.sources[0];
    expect(citation.id).toContain(citation.revision);
    expect(citation).not.toHaveProperty('body');
    expect(await read(w.ownerA, [citation.id])).toMatchObject([{id: citation.id, section: 'Zvonky', body: 'Výměna zvonků byla schválena.'}]);
    const passages = await read(w.ownerA, [citation.id]);
    expect(JSON.stringify(passages)).not.toContain('nesouvisející');
    for (const user of [w.ownerB, w.boardB, w.outsider, w.suspendedA]) expect(await read(user, [citation.id])).toEqual([]);
    expect(await read(w.ownerA, [citation.id], w.orgB)).toEqual([]);
    await w.db.rpc(w.boardA, 'public.withdraw_house_markdown($1,$2)', [w.orgA, citation.note_key]);
    expect(await read(w.ownerA, [citation.id])).toEqual([]);
    expect(await read(w.boardA, [citation.id])).toEqual([]);
  } finally { await w.db.pg.close(); }
});

it('does not answer from a passage withdrawn while generation was in flight', async () => {
  const w = await buildWorld();
  try {
    await w.db.rpc(w.boardA, 'public.publish_house_markdown($1,$2,$3,$4)', [w.orgA, 'synteticky-plan', 'Syntetický plán', '## Plán\nZvonky čekají na modelového dodavatele.']);
    const read = (ids: string[] | null) => w.db.rpc<Source[]>(w.ownerA, 'public.read_house_markdown($1,$2,$3)', [w.orgA, ids ? [] : ['zvonk'], ids]);
    expect(await answerQuestion('Zvonky?', {
      search: () => read(null), recheck: read,
      generate: async () => {
        await w.db.rpc(w.boardA, 'public.withdraw_house_markdown($1,$2)', [w.orgA, 'synteticky-plan']);
        return {kind: 'answer', claims: [{text: 'Zvonky čekají.', citations: [1]}]};
      },
    })).toEqual({kind: 'unknown'});
  } finally { await w.db.pg.close(); }
});
