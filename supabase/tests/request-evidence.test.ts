import { expect, it } from 'vitest';
import { buildWorld } from './helpers/fixtures';
import { expectDbError } from './helpers/db';

it('links an exact ready archive version without expanding request or archive access', async () => {
  const w = await buildWorld();
  try {
    await w.db.admin("insert into storage.buckets (id,name) values ('documents','documents') on conflict do nothing");
    const { id } = await w.db.rpc<{ id: string }>(w.ownerA, "public.create_request($1,'defect','Teplá voda','Syntetický podnět',null,'T-013')", [w.orgA]);
    await w.db.admin('update public.requests set assignee_user_id = $2 where id = $1', [id, w.technicalA]);
    async function ready(org: string, board: string, audience: string) {
      const doc = await w.db.rpc<string>(board, "public.create_document($1,'Testovací protokol','revize',null,null,$2)", [org, audience]);
      const v = await w.db.rpc<{version_id: string; object_key: string}>(board, "public.begin_upload($1,'test.pdf','application/pdf',10,$2)", [doc, 'a'.repeat(64)]);
      const link = (actor: string | null) => w.db.rpc(actor, 'public.attach_request_evidence($1,$2)', [id, v.version_id]);
      if (org === w.orgA) await expectDbError(link(board), 'PT404');
      await w.db.q(board, "insert into storage.objects (bucket_id,name,owner,metadata) values ('documents',$1,auth.uid(),'{\"size\":10,\"mimetype\":\"application/pdf\"}')", [v.object_key]);
      await w.db.rpc(board, 'public.complete_upload($1)', [v.version_id]);
      const [{row_version}] = await w.db.admin<{row_version: number}>('select row_version from public.documents where id=$1', [doc]);
      await w.db.rpc(board, 'public.publish_version($1,$2,$3)', [doc,v.version_id,row_version]);
      return { ...v, doc, link };
    }
    const privateDoc = await ready(w.orgA,w.boardA,'board');
    const shared = await ready(w.orgA,w.boardA,'owners');
    const foreign = await ready(w.orgB,w.boardB,'owners');
    await expectDbError(foreign.link(w.boardA),'PT404');
    await expectDbError(shared.link(w.ownerA),'PT404');
    await expectDbError(shared.link(null),'42501');
    await privateDoc.link(w.boardA);
    await shared.link(w.technicalA);
    await shared.link(w.technicalA);
    const list = (actor: string) => w.db.q<{version_id: string}>(actor,'select version_id from public.request_evidence where request_id=$1 order by version_id',[id]);
    expect(await list(w.boardA)).toHaveLength(2);
    expect(await list(w.ownerA)).toEqual([{version_id:shared.version_id}]);
    expect(await list(w.ownerA2)).toEqual([]);
    expect(await list(w.ownerB)).toEqual([]);
    await expectDbError(w.db.rpc(w.ownerA,'public.authorize_download($1)',[privateDoc.version_id]),'PT404');
    expect(await w.db.q(w.ownerA,'select name from storage.objects where name=$1',[privateDoc.object_key])).toEqual([]);
    await expectDbError(w.db.q(w.boardA,'delete from public.request_evidence where request_id=$1',[id]),'42501');
    const v2 = await w.db.rpc<{version_id: string; object_key: string}>(w.boardA, "public.begin_upload($1,'test-v2.pdf','application/pdf',10,$2)", [shared.doc, 'b'.repeat(64)]);
    await w.db.q(w.boardA, "insert into storage.objects (bucket_id,name,owner,metadata) values ('documents',$1,auth.uid(),$2)", [v2.object_key, JSON.stringify({size:10,mimetype:'application/pdf'})]);
    await w.db.rpc(w.boardA, 'public.complete_upload($1)', [v2.version_id]);
    const [{row_version: beforePublish}] = await w.db.admin<{row_version: number}>('select row_version from public.documents where id=$1', [shared.doc]);
    await w.db.rpc(w.boardA, 'public.publish_version($1,$2,$3)', [shared.doc,v2.version_id,beforePublish]);
    expect(await list(w.ownerA)).toEqual([{version_id:shared.version_id}]);
    expect(await w.db.rpc(w.ownerA,'public.authorize_download($1)',[shared.version_id])).toMatchObject({object_key:shared.object_key});
    const [{row_version}] = await w.db.admin<{row_version: number}>('select row_version from public.documents where id=$1', [shared.doc]);
    await w.db.rpc(w.boardA,"public.set_document_lifecycle($1,'withdrawn',$2)",[shared.doc,row_version]);
    expect(await list(w.ownerA)).toEqual([]);
    await expectDbError(w.db.rpc(w.ownerA,'public.authorize_download($1)',[shared.version_id]),'PT404');
    expect(await w.db.admin("select id from public.audit_events where action='attach_request_evidence' and object_id=$1",[id])).toHaveLength(2);
  } finally { await w.db.pg.close(); }
});
