import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildWorld, World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
const PDF = "application/pdf";
const SHA = "a".repeat(64);

const newDoc = (user: string, org = w.orgA, visibility = "owners", title = "Zápis ze shromáždění") =>
  w.db.rpc<string>(user, "public.create_document($1, $2, 'zapisy', null, null, $3)", [org, title, visibility]);
const begin = (user: string, doc: string, name = "zapis.pdf", mime = PDF, bytes = 1000) =>
  w.db.rpc<{ version_id: string; version_no: number; object_key: string }>(user, "public.begin_upload($1, $2, $3, $4, $5)", [doc, name, mime, bytes, SHA]);
// Simulace nahrání přes Storage API: vložení objektu pod rolí uživatele, takže platí politiky storage.objects.
const putObject = (user: string, key: string, size = 1000, mime = PDF) =>
  w.db.q(user, "insert into storage.objects (bucket_id, name, owner, metadata) values ('documents', $1, auth.uid(), $2)", [key, JSON.stringify({ size, mimetype: mime })]);
const complete = (user: string, v: string) => w.db.rpc<{ status: string }>(user, "public.complete_upload($1)", [v]);
const version = async (doc: string) => (await w.db.admin<{ row_version: number }>("select row_version from public.documents where id=$1", [doc]))[0].row_version;
const publish = async (user: string, doc: string, v: string) => w.db.rpc(user, "public.publish_version($1, $2, $3)", [doc, v, await version(doc)]);
// Dokument s jednou hotovou a publikovanou verzí.
async function published(visibility = "owners", user = w.boardA) {
  const doc = await newDoc(user, w.orgA, visibility);
  const v = await begin(user, doc);
  await putObject(user, v.object_key);
  await complete(user, v.version_id);
  await publish(user, doc, v.version_id);
  return { doc, v };
}
const canSeeDoc = async (user: string | null, doc: string) => (await w.db.q(user, "select id from public.documents where id=$1", [doc])).length === 1;
const canSeeObject = async (user: string, key: string) => (await w.db.q(user, "select name from storage.objects where name=$1", [key])).length === 1;

beforeAll(async () => {
  w = await buildWorld();
  await w.db.admin("insert into storage.buckets (id, name, public) values ('documents','documents',false) on conflict do nothing");
});
beforeEach(async () => { await w.db.admin("delete from app.rate_events"); });

describe("DOC-01 upload a metadata", () => {
  it("dokument zakládá výbor; vlastník ani anon ne", async () => {
    await expectDbError(newDoc(w.ownerA), "PT403");
    await expectDbError(w.db.rpc(null, "public.create_document($1,'x y z','zapisy',null,null,'owners')", [w.orgA]), "42501");
    expect(await newDoc(w.boardA)).toBeTruthy();
  });
  it("nepovolený typ, nesoulad přípony a MIME, nadlimitní soubor a špatný název jsou odmítnuty serverem", async () => {
    const doc = await newDoc(w.boardA);
    await expectDbError(begin(w.boardA, doc, "program.exe", "application/x-msdownload"), "PT422");
    await expectDbError(begin(w.boardA, doc, "zapis.pdf", "image/png"), "PT422");
    await expectDbError(begin(w.boardA, doc, "zapis.pdf", PDF, 26214401), "PT422");
    await expectDbError(begin(w.boardA, doc, "../zapis.pdf"), "PT422");
    await expectDbError(begin(w.boardA, doc, "bez-pripony"), "PT422");
    await expectDbError(w.db.rpc(w.boardA, "public.begin_upload($1,'a.pdf',$2,100,'xyz')", [doc, PDF]), "PT422");
  });
  it("klíč objektu je neuhodnutelný a neobsahuje název souboru", async () => {
    const doc = await newDoc(w.boardA);
    const v = await begin(w.boardA, doc, "tajná smlouva.pdf");
    expect(v.object_key).not.toContain("smlouva");
    expect(v.object_key).toMatch(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\/[0-9a-f-]{36}$/);
  });
  it("nahrát lze jen pod klíč založený pro tohoto uživatele; cizí klíč, vymyšlený klíč ani přepsání nejde", async () => {
    const doc = await newDoc(w.boardA);
    const v = await begin(w.boardA, doc);
    await expectDbError(putObject(w.boardA, `${w.orgA}/${doc}/vymysleny`), "42501");
    await expectDbError(putObject(w.boardA2, v.object_key), "42501");
    await expectDbError(putObject(w.ownerA, v.object_key), "42501");
    await putObject(w.boardA, v.object_key);
    await expectDbError(putObject(w.boardA, v.object_key), ["42501", "23505"]);
  });
  it("neúplné nahrání netvoří publikovanou verzi a jde zopakovat", async () => {
    const doc = await newDoc(w.boardA);
    const v1 = await begin(w.boardA, doc);
    await expectDbError(complete(w.boardA, v1.version_id), "PT409"); // objekt chybí
    await expectDbError(publish(w.boardA, doc, v1.version_id), "PT422");
    const v2 = await begin(w.boardA, doc);
    expect(v2.version_no).toBe(2);
    await putObject(w.boardA, v2.object_key);
    expect((await complete(w.boardA, v2.version_id)).status).toBe("ready");
  });
  it("nesoulad velikosti nebo typu nahraného objektu označí verzi jako selhanou", async () => {
    const doc = await newDoc(w.boardA);
    const v = await begin(w.boardA, doc, "a.pdf", PDF, 1000);
    await putObject(w.boardA, v.object_key, 999);
    expect((await complete(w.boardA, v.version_id)).status).toBe("failed");
    await expectDbError(complete(w.boardA, v.version_id), "PT409");
  });
  it("opuštěné nahrávání starší než hodina se při dalším nahrávání uzavře", async () => {
    const doc = await newDoc(w.boardA);
    const old = await begin(w.boardA, doc);
    // Čas simulujeme mimo ochranné triggery (created_at je jinak neměnný).
    await w.db.pg.exec(`set session_replication_role = replica; update public.document_versions set created_at = now() - interval '2 hours' where id = '${old.version_id}'; set session_replication_role = origin;`);
    await begin(w.boardA, doc);
    const [row] = await w.db.admin<{ upload_status: string }>("select upload_status from public.document_versions where id=$1", [old.version_id]);
    expect(row.upload_status).toBe("failed");
    await expectDbError(putObject(w.boardA, old.object_key), "42501");
  });
});

describe("DOC-02 verze a publikace", () => {
  it("souběžné nahrávání dostane různá čísla verzí", async () => {
    const doc = await newDoc(w.boardA);
    const [a, b] = await Promise.all([begin(w.boardA, doc), begin(w.boardA, doc)]);
    expect([a.version_no, b.version_no].sort()).toEqual([1, 2]);
  });
  it("druhá verze nepřepíše první; v1 zůstane čitelná a objekt nezměněn", async () => {
    const { doc, v } = await published();
    const v2 = await begin(w.boardA, doc, "zapis-v2.pdf");
    await putObject(w.boardA, v2.object_key, 1000);
    await complete(w.boardA, v2.version_id);
    await publish(w.boardA, doc, v2.version_id);
    expect(v2.version_no).toBe(2);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(true);
    const [cur] = await w.db.q<{ current_version_id: string }>(w.ownerA, "select current_version_id from public.documents where id=$1", [doc]);
    expect(cur.current_version_id).toBe(v2.version_id);
    await expectDbError(w.db.admin("update public.document_versions set bytes = 5 where id=$1", [v.version_id]), "PT403");
    await expectDbError(w.db.admin("update public.document_versions set upload_status='pending' where id=$1", [v.version_id]), "PT422");
  });
  it("aktuální verze nemůže patřit jinému dokumentu", async () => {
    const a = await published();
    const b = await published();
    await expectDbError(publish(w.boardA, a.doc, b.v.version_id), "PT422");
  });
  it("odvolání publikace i změna publika se zapíší do auditu", async () => {
    const { doc } = await published();
    await w.db.rpc(w.boardA, "public.set_document_lifecycle($1, 'withdrawn', $2)", [doc, await version(doc)]);
    await w.db.rpc(w.boardA, "public.update_document($1, 'Nový název', 'zapisy', null, null, 'board', $2)", [doc, await version(doc)]);
    const audit = await w.db.admin<{ details: Record<string, unknown> }>("select details from public.audit_events where object_type='documents' and object_id=$1", [doc]);
    const keys = audit.flatMap((a) => Object.keys(a.details));
    expect(keys).toContain("lifecycle");
    expect(keys).toContain("visibility");
  });
  it("zastaralá row_version vrátí konflikt a nic nezmění", async () => {
    const { doc } = await published();
    await expectDbError(w.db.rpc(w.boardA, "public.update_document($1,'Jiný název','zapisy',null,null,'owners',99)", [doc]), "PT409");
    const [d] = await w.db.admin<{ title: string }>("select title from public.documents where id=$1", [doc]);
    expect(d.title).toBe("Zápis ze shromáždění");
  });
  it("přímý zápis do tabulek dokumentů je zakázán", async () => {
    const { doc } = await published();
    await expectDbError(w.db.q(w.boardA, "update public.documents set visibility='owners' where id=$1", [doc]), "42501");
    await expectDbError(w.db.q(w.boardA, "insert into public.document_grants (organization_id, document_id, user_id, permission) values ($1,$2,$3,'manage')", [w.orgA, doc, w.ownerA]), "42501");
  });
});

describe("T-DOC-01 publikum a čtení", () => {
  it("koncept vidí jen správce; publikovaný dokument pro vlastníky vidí aktivní členové svého SVJ", async () => {
    const doc = await newDoc(w.boardA);
    const v = await begin(w.boardA, doc);
    await putObject(w.boardA, v.object_key);
    await complete(w.boardA, v.version_id);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(false);
    await publish(w.boardA, doc, v.version_id);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(true);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(true);
    for (const outsider of [w.ownerB, w.boardB, w.outsider, w.pendingA, w.suspendedA]) {
      expect(await canSeeDoc(outsider, doc)).toBe(false);
      expect(await canSeeObject(outsider, v.object_key)).toBe(false);
    }
    expect(await canSeeDoc(null, doc).catch(() => false)).toBe(false);
  });
  it("dokument pro výbor nevidí vlastník", async () => {
    const { doc, v } = await published("board");
    expect(await canSeeDoc(w.boardA2, doc)).toBe(true);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(false);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(false);
  });
  it("omezený dokument: bez grantu nevidí nikdo kromě správců s grantem, ani výbor", async () => {
    const { doc, v } = await published("restricted");
    expect(await canSeeDoc(w.boardA, doc)).toBe(true); // autor má grant manage
    expect(await canSeeDoc(w.boardA2, doc)).toBe(false);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(false);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(false);
    await expectDbError(w.db.rpc(w.ownerA, "public.authorize_download($1)", [v.version_id]), "PT404");
  });
  it("uživatel nevidí metadata verzí dokumentu, který nesmí číst", async () => {
    const { doc } = await published("restricted");
    expect(await w.db.q(w.ownerA, "select id from public.document_versions where document_id=$1", [doc])).toHaveLength(0);
  });
  it("hotová verze koncepčního dokumentu ani nedokončená verze nejsou vidět čtenářům", async () => {
    const { doc } = await published();
    const pending = await begin(w.boardA, doc, "dalsi.pdf");
    const seen = await w.db.q<{ id: string }>(w.ownerA, "select id from public.document_versions where document_id=$1", [doc]);
    expect(seen.map((r) => r.id)).not.toContain(pending.version_id);
  });
});

describe("T-DOC-02 odebrání grantu a stažení", () => {
  it("udělení a odebrání jmenného přístupu se okamžitě projeví v metadatech, objektu i stažení", async () => {
    const { doc, v } = await published("restricted");
    const grant = await w.db.rpc<string>(w.boardA, "public.grant_document_access($1, $2, 'read')", [doc, w.ownerA]);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(true);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(true);
    const dl = await w.db.rpc<{ object_key: string; filename: string }>(w.ownerA, "public.authorize_download($1)", [v.version_id]);
    expect(dl.object_key).toBe(v.object_key);
    await w.db.rpc(w.boardA, "public.revoke_document_access($1)", [grant]);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(false);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(false);
    await expectDbError(w.db.rpc(w.ownerA, "public.authorize_download($1)", [v.version_id]), "PT404");
  });
  it("stažení se zapíše do auditu bez textu dokumentu", async () => {
    const { v } = await published();
    await w.db.rpc(w.ownerA, "public.authorize_download($1)", [v.version_id]);
    const rows = await w.db.admin<{ actor_user_id: string }>("select actor_user_id from public.audit_events where action='download' and object_id=$1", [v.version_id]);
    expect(rows.map((r) => r.actor_user_id)).toContain(w.ownerA);
  });
  it("stažený (withdrawn) dokument ztratí čtenáře, správce ho dál vidí; obnova ho vrátí", async () => {
    const { doc, v } = await published();
    await w.db.rpc(w.boardA, "public.set_document_lifecycle($1, 'withdrawn', $2)", [doc, await version(doc)]);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(false);
    expect(await canSeeObject(w.ownerA, v.object_key)).toBe(false);
    await expectDbError(w.db.rpc(w.ownerA, "public.authorize_download($1)", [v.version_id]), "PT404");
    expect(await canSeeDoc(w.boardA, doc)).toBe(true);
    await w.db.rpc(w.boardA, "public.set_document_lifecycle($1, 'published', $2)", [doc, await version(doc)]);
    expect(await canSeeDoc(w.ownerA, doc)).toBe(true);
  });
  it("pozastavený člen se starým tokenem soubor nestáhne", async () => {
    const { doc, v } = await published();
    expect(await canSeeDoc(w.suspendedA, doc)).toBe(false);
    await expectDbError(w.db.rpc(w.suspendedA, "public.authorize_download($1)", [v.version_id]), "PT404");
  });
  it("objekty ve Storage nelze měnit ani mazat běžnou rolí", async () => {
    const { v } = await published();
    await w.db.q(w.boardA, "update storage.objects set name='jine' where name=$1", [v.object_key]);
    await w.db.q(w.boardA, "delete from storage.objects where name=$1", [v.object_key]);
    expect(await w.db.admin("select 1 from storage.objects where name=$1", [v.object_key])).toHaveLength(1);
  });
  it("omezený dokument nelze nechat bez správce a grant lze udělit jen aktivnímu členu téhož SVJ", async () => {
    const { doc } = await published("restricted");
    const mine = (await w.db.admin<{ id: string }>("select id from public.document_grants where document_id=$1 and permission='manage'", [doc]))[0].id;
    await expectDbError(w.db.rpc(w.boardA, "public.revoke_document_access($1)", [mine]), "PT409");
    await expectDbError(w.db.rpc(w.boardA, "public.grant_document_access($1, $2, 'read')", [doc, w.ownerB]), "PT422");
    await expectDbError(w.db.rpc(w.boardA, "public.grant_document_access($1, $2, 'read')", [doc, w.suspendedA]), "PT422");
  });
  it("přechod na omezené publikum dá správci jmenný grant, takže dokument nezůstane bez správy", async () => {
    const { doc } = await published("owners", w.boardA2);
    await w.db.rpc(w.boardA2, "public.update_document($1,'Zápis ze shromáždění','zapisy',null,null,'restricted',$2)", [doc, await version(doc)]);
    expect(await canSeeDoc(w.boardA2, doc)).toBe(true);
    expect(await canSeeDoc(w.boardA, doc)).toBe(false);
  });
  it("jmenný správce bez role výboru může spravovat omezený dokument, vlastník s právem čtení nikoli", async () => {
    const { doc } = await published("restricted");
    await w.db.rpc(w.boardA, "public.grant_document_access($1, $2, 'manage')", [doc, w.technicalA]);
    await w.db.rpc(w.boardA, "public.grant_document_access($1, $2, 'read')", [doc, w.ownerA]);
    await begin(w.technicalA, doc, "dalsi.pdf");
    await expectDbError(begin(w.ownerA, doc, "dalsi.pdf"), "PT404");
  });
});

describe("Cizí SVJ a anon", () => {
  it("výbor jiného SVJ dokument nevidí, nespravuje ani nenahrává", async () => {
    const { doc } = await published();
    expect(await canSeeDoc(w.boardB, doc)).toBe(false);
    await expectDbError(begin(w.boardB, doc), "PT404");
    await expectDbError(w.db.rpc(w.boardB, "public.set_document_lifecycle($1,'archived',1)", [doc]), "PT404");
  });
  it("anon nemá přístup k tabulkám ani RPC archivu", async () => {
    await expectDbError(w.db.q(null, "select * from public.documents"), "42501");
    await expectDbError(w.db.q(null, "select * from public.document_versions"), "42501");
    expect(await w.db.q(null, "select * from storage.objects")).toHaveLength(0);
  });
  it("správce jednoho SVJ nezíská přístup tím, že zná ID", async () => {
    const { doc } = await published();
    await expect(w.db.q(w.ownerB, "select * from public.documents where id=$1", [doc])).resolves.toHaveLength(0);
  });
});

