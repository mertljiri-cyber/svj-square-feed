import { expect, it } from 'vitest';
import { buildWorld, membershipId } from './helpers/fixtures';
import { expectDbError } from './helpers/db';

it('retrieves only approved excerpts backed by the current readable PDF in this SVJ', async () => {
  const w = await buildWorld();
  try {
    const { db } = w;
    async function fixture(board: string, org: string, audience: string, approved = true) {
      const doc = await db.rpc<string>(board, "public.create_document($1,'Syntetický zápis','zapisy',null,null,$2)", [org, audience]);
      const [{ id: v }] = await db.admin<{id: string}>(`insert into public.document_versions (organization_id,document_id,version_no,object_key,original_filename,mime_type,bytes,sha256,upload_status) values ($1,$2,1,gen_random_uuid()::text,'test.pdf','application/pdf',10,repeat('a',64),'ready') returning id`, [org,doc]);
      const [{row_version}] = await db.admin<{row_version: number}>('select row_version from public.documents where id=$1',[doc]);
      await db.rpc(board,'public.publish_version($1,$2,$3)',[doc,v,row_version]);
      await db.admin(`insert into public.wiki_excerpts(organization_id,document_id,version_id,page,body,note_key,source_revision,approved_at) values ($1,$2,$3,3,'Zvonky: pouze návrh opravy.','plan-oprav',repeat('b',64),$4)`,[org,doc,v,approved ? new Date().toISOString() : null]);
      return {doc,v};
    }
    const search = (actor: string | null, org = w.orgA, query = 'zvonky') => db.rpc<Array<{document_id: string; version_id: string; page: number}>>(actor,'public.search_wiki_sources($1,$2,$3)',[org,query,5]);
    await expectDbError(search(null),'42501');
    const shared = await fixture(w.boardA,w.orgA,'owners');
    await fixture(w.boardA,w.orgA,'board');
    await fixture(w.boardA,w.orgA,'owners',false);
    await fixture(w.boardB,w.orgB,'owners');
    const authorized = await search(w.ownerA);
    expect(authorized).toHaveLength(1);
    expect(authorized[0]).toMatchObject({document_id:shared.doc,version_id:shared.v,page:3});
    expect(await search(w.boardA)).toHaveLength(1);
    expect(await search(w.ownerA,w.orgB)).toEqual([]);
    expect(await search(w.ownerA,w.orgA,'střecha')).toEqual([]);
    expect(await search(w.pendingA)).toEqual([]);
    expect(await db.q(w.boardA,'select id from public.wiki_excerpts')).toHaveLength(1);
    await expectDbError(db.q(w.boardA,'update public.wiki_excerpts set approved_at = null'),'42501');
    const id = await membershipId(db,w.orgA,w.ownerA2);
    const [mem] = await db.admin<{row_version:number}>('select row_version from public.memberships where id=$1',[id]);
    expect(await search(w.ownerA2)).toHaveLength(1);
    await db.rpc(w.boardA,"public.set_membership_status($1,'suspended',$2)",[id,mem.row_version]);
    expect(await search(w.ownerA2)).toEqual([]);
    const [{id: next}] = await db.admin<{id:string}>(`insert into public.document_versions (organization_id,document_id,version_no,object_key,original_filename,mime_type,bytes,sha256,upload_status) values ($1,$2,2,gen_random_uuid()::text,'test-v2.pdf','application/pdf',10,repeat('c',64),'ready') returning id`,[w.orgA,shared.doc]);
    const [beforePublish] = await db.admin<{row_version:number}>('select row_version from public.documents where id=$1',[shared.doc]);
    await db.rpc(w.boardA,'public.publish_version($1,$2,$3)',[shared.doc,next,beforePublish.row_version]);
    expect(await search(w.ownerA)).toEqual([]);
    await db.admin(`insert into public.wiki_excerpts(organization_id,document_id,version_id,page,body,note_key,source_revision,approved_at) values ($1,$2,$3,3,'Zvonky: podklad v2.','plan-oprav',repeat('c',64),now())`,[w.orgA,shared.doc,next]);
    expect(await search(w.ownerA)).toHaveLength(1);
    const [beforeWithdraw] = await db.admin<{row_version:number}>('select row_version from public.documents where id=$1',[shared.doc]);
    await db.rpc(w.boardA,"public.set_document_lifecycle($1,'withdrawn',$2)",[shared.doc,beforeWithdraw.row_version]);
    expect(await search(w.ownerA)).toEqual([]);
  } finally { await w.db.pg.close(); }
});
