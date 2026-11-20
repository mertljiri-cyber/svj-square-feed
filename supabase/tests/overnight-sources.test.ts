import { expect, it } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { sourceMetadata, type SourceEvent } from '../../src/features/sourceMetadata';

it('derives note state, revision and last change from metadata without reading note bodies', async () => {
  const w = await buildWorld();
  try {
    const publish = (body: string) => w.db.rpc<string>(w.boardA, 'public.publish_house_markdown($1,$2,$3,$4)', [w.orgA, 'synteticke-opravy', 'Syntetické opravy', body]);
    const read = (user: string, org = w.orgA) => w.db.q<SourceEvent>(user, "select id,action,object_id,occurred_at,details from public.audit_events where organization_id=$1 and object_type='house_markdown' order by id desc", [org]);
    const first = await publish('## Plán\nSyntetické zvonky čekají na dodavatele.');
    let events = await read(w.boardA);
    expect(sourceMetadata(events)).toMatchObject([{key: 'synteticke-opravy', active: true, revision: first, changedAt: events[0].occurred_at}]);
    expect(JSON.stringify(events)).not.toContain('dodavatele');
    for (const user of [w.ownerA, w.ownerA2, w.ownerB, w.boardB, w.suspendedA]) expect(await read(user)).toEqual([]);
    expect(await read(w.boardA, w.orgB)).toEqual([]);
    const second = await publish('## Plán\nSyntetické zvonky jsou objednány.');
    expect(second).not.toBe(first);
    events = await read(w.boardA);
    expect(sourceMetadata([...events].reverse())).toMatchObject([{active: true, revision: second}]);
    await w.db.rpc(w.boardA, 'public.withdraw_house_markdown($1,$2)', [w.orgA, 'synteticke-opravy']);
    events = await read(w.boardA);
    expect(sourceMetadata(events)).toMatchObject([{active: false, revision: second, changedAt: events[0].occurred_at}]);
  } finally { await w.db.pg.close(); }
});

it('ignores unrelated events and treats metadata values as data, not markup', () => {
  const event = {id: 1, action: 'publish_house_markdown', object_id: 'opravy', occurred_at: '2026-11-21T00:00:00Z', details: {revision: '<b>not a hash</b>'}};
  expect(sourceMetadata([event])).toMatchObject([{key: 'opravy', revision: null}]);
  expect(sourceMetadata([{...event, object_id: '<b>note</b>'}, {...event, action: 'other'}])).toEqual([]);
});
