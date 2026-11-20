import { expect, it } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { expectDbError } from './helpers/db';

it('keeps Markdown private, checks membership and limits repeated questions', async () => {
  const w=await buildWorld();
  try {
    const quota = (user:string|null, org=w.orgA) => w.db.rpc(user,'public.consume_house_question($1)',[org]);
    await expectDbError(quota(null),'42501');
    await expectDbError(quota(w.ownerA,w.orgB),'PT403');
    await expectDbError(quota(w.suspendedA),'PT403');
    for(let i=0;i<12;i++) await quota(w.ownerA);
    await expectDbError(quota(w.ownerA),'PT429');
    await quota(w.ownerA2);
    const search = (user:string|null) => w.db.rpc(user,'public.search_house_terms($1,$2)',[w.orgA,['zvonk']]);
    await expectDbError(search(null),'42501');
    expect(await search(w.ownerA)).toEqual([]);
    expect(await w.db.admin("select public from storage.buckets where id='svj-wiki-markdown'")).toEqual([{public:false}]);
    await expectDbError(w.db.q(w.boardA,'select object_key from public.wiki_markdown_revisions'),'42501');
  } finally { await w.db.pg.close(); }
});
