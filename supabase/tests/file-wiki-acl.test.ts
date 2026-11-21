import { expect, it } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { expectDbError } from './helpers/db';

it('exposes release metadata only to active members and disables legacy on a tombstone', async () => {
  const w = await buildWorld();
  const id = '00000000-0000-4000-8000-000000000099';
  const sha = 'a'.repeat(64);
  try {
    const get = (who: string|null, org = w.orgA) => w.db.rpc(who, 'public.get_house_file_release($1)', [org]);
    const legacy = () => w.db.rpc(w.ownerA, 'public.read_house_markdown($1,$2)', [w.orgA,['výtah']]);
    expect(await get(w.ownerA)).toBeNull();
    await w.db.rpc(w.boardA,'public.publish_house_markdown($1,$2,$3,$4)',[w.orgA,'vytah','Výtah','Výtah čeká na servis.']);
    expect(await legacy()).toMatchObject([{body:'Výtah čeká na servis.'}]);
    await expectDbError(w.db.rpc(w.boardA,'public.set_house_file_release($1,$2,$3)',[w.orgA,id,sha]),'42501');
    await w.db.admin('select public.set_house_file_release($1,$2,$3)',[w.orgA,id,sha]);
    expect(await get(w.ownerA)).toEqual({id,manifest_sha256:sha});
    await expectDbError(get(w.ownerA,w.orgB),'PT403');
    await expectDbError(get(w.ownerB),'PT403');
    await expectDbError(get(w.suspendedA),'PT403');
    await expectDbError(get(null),'42501');
    expect(await legacy()).toEqual([]);
    await w.db.admin("insert into storage.objects (bucket_id,name) values ('svj-wiki-releases','test.md')");
    expect(await w.db.q(w.ownerA,"select * from storage.objects where bucket_id='svj-wiki-releases'")).toEqual([]);
    await w.db.admin('select public.set_house_file_release($1,null,null)',[w.orgA]);
    expect(await get(w.ownerA)).toEqual({id:null,manifest_sha256:null});
    expect(await legacy()).toEqual([]);
    await expectDbError(w.db.admin('select public.set_house_file_release($1,$2,$3)',[w.orgA,id,sha]),'23505');
  } finally { await w.db.pg.close(); }
});
