import { it, expect } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { expectDbError } from './helpers/db';

it('imports Markdown without PDFs and searches only current notes in the caller’s SVJ', async () => {
  const w = await buildWorld();
  try {
    const publish = (user: string|null, text:string) => w.db.rpc(user, 'public.publish_house_markdown($1,$2,$3,$4)', [w.orgA,'opravy','Opravy',text]);
    const lookup = (user:string|null, org=w.orgA, ids:string[]|null=null) => w.db.rpc<Array<{id:string,body:string,section:string}>>(user,'public.read_house_markdown($1,$2,$3)',[org,['zvonk'],ids]);
    await expectDbError(publish(w.ownerA,'## Stav\nZvonky čekají na dodavatele.'),'PT403');
    await expectDbError(lookup(null),'42501');
    const v1='## Stav\n\nZvonky čekají na dodavatele.\n';
    await publish(w.boardA,v1);
    await publish(w.boardA,v1);
    const [hit]=await lookup(w.ownerA);
    expect(hit).toMatchObject({body:'Zvonky čekají na dodavatele.',section:'Stav'});
    expect(await lookup(w.ownerB)).toEqual([]);
    expect(await lookup(w.suspendedA)).toEqual([]);
    expect(await lookup(w.ownerA,w.orgA,[hit.id])).toEqual([hit]);
    await publish(w.boardA,'## Stav\n\nZvonky jsou ve zkušebním provozu.\n');
    expect(await lookup(w.ownerA,w.orgA,[hit.id])).toEqual([]);
    expect(await lookup(w.ownerA)).toMatchObject([{body:'Zvonky jsou ve zkušebním provozu.'}]);
    await w.db.rpc(w.boardA,'public.withdraw_house_markdown($1,$2)',[w.orgA,'opravy']);
    expect(await lookup(w.ownerA)).toEqual([]);
  } finally { await w.db.pg.close(); }
});
