import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildWorld, World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
type Created = { id: string; number: number; duplicate: boolean };
const create = (user: string | null, org: string, title = "Nestabilní teplota vody", key: string | null = null) =>
  w.db.rpc<Created>(user, "public.create_request($1, 'defect', $2, 'Popis problému', 'Suterén', 'T-013', $3)", [org, title, key]);
const version = async (id: string) => (await w.db.admin<{ row_version: number }>("select row_version from public.requests where id=$1", [id]))[0].row_version;
const status = async (id: string) => (await w.db.admin<{ workflow_status: string }>("select workflow_status from public.requests where id=$1", [id]))[0].workflow_status;
const change = async (user: string, id: string, to: string, extra = "", params: unknown[] = []) =>
  w.db.rpc(user, `public.change_request_status($1, '${to}', $2${extra})`, [id, await version(id), ...params]);

beforeAll(async () => { w = await buildWorld(); });
// Limity mají vlastní test; ostatní testy zakládají mnoho požadavků jedním autorem.
beforeEach(async () => { await w.db.admin("delete from app.rate_events"); });

describe("T-REQ-01 přijetí požadavku", () => {
  it("autor získá číslo, další požadavek číslo+1, jiné SVJ počítá od jedné", async () => {
    const a = await create(w.ownerA, w.orgA);
    const b = await create(w.ownerA, w.orgA, "Druhý požadavek");
    const c = await create(w.ownerB, w.orgB, "Požadavek jiného SVJ");
    expect([a.number, b.number, c.number]).toEqual([1, 2, 1]);
  });
  it("opakovaný submit se stejným klíčem nezaloží druhý požadavek ani událost", async () => {
    const key = "idem-key-0001";
    const first = await create(w.ownerA2, w.orgA, "S klíčem", key);
    const second = await create(w.ownerA2, w.orgA, "S klíčem", key);
    expect(second.id).toBe(first.id);
    expect(second.duplicate).toBe(true);
    const [{ n }] = await w.db.admin<{ n: number }>("select count(*)::int n from public.request_events where request_id=$1", [first.id]);
    expect(n).toBe(1);
  });
  it("požadavek je soukromý: jiný vlastník, jiné SVJ ani anon ho nevidí", async () => {
    const r = await create(w.ownerA, w.orgA, "Soukromý text");
    expect(await w.db.q(w.ownerA, "select id from public.requests where id=$1", [r.id])).toHaveLength(1);
    expect(await w.db.q(w.ownerA2, "select id from public.requests where id=$1", [r.id])).toHaveLength(0);
    expect(await w.db.q(w.ownerB, "select id from public.requests where id=$1", [r.id])).toHaveLength(0);
    expect(await w.db.q(w.boardB, "select id from public.requests where id=$1", [r.id])).toHaveLength(0);
    expect(await w.db.q(w.boardA, "select id from public.requests where id=$1", [r.id])).toHaveLength(1);
    await expectDbError(w.db.q(null, "select id from public.requests"), "42501");
  });
  it("přímý zápis do tabulek je zakázán", async () => {
    const r = await create(w.ownerA, w.orgA, "Přímý zápis");
    await expectDbError(w.db.q(w.ownerA, "insert into public.requests (organization_id, number, author_user_id, type, title, description) values ($1, 99, $2, 'defect', 'xxx', 'xxx')", [w.orgA, w.ownerA]), "42501");
    await expectDbError(w.db.q(w.ownerA, "update public.requests set workflow_status='closed' where id=$1", [r.id]), "42501");
    await expectDbError(w.db.q(w.boardA, "update public.requests set workflow_status='closed' where id=$1", [r.id]), "42501");
    await expectDbError(w.db.q(w.ownerA, "insert into public.request_events (organization_id, request_id, event_type) values ($1,$2,'comment')", [w.orgA, r.id]), "42501");
  });
  it("nečlen, čekající a pozastavený člen požadavek nepodají; anon nemá přístup k RPC", async () => {
    for (const user of [w.outsider, w.pendingA, w.suspendedA]) await expectDbError(create(user, w.orgA), "PT403");
    await expectDbError(create(null, w.orgA), "42501");
  });
  it("serverová validace odmítne neplatný typ, krátký název a špatný odkaz na prvek", async () => {
    await expectDbError(w.db.rpc(w.ownerA, "public.create_request($1, 'jine', 'Název', 'Popis')", [w.orgA]), "PT422");
    await expectDbError(create(w.ownerA, w.orgA, "ab"), "PT422");
    await expectDbError(w.db.rpc(w.ownerA, "public.create_request($1, 'defect', 'Název', 'Popis', null, 'neplatne')", [w.orgA]), "PT422");
  });
  it("autor nemůže podat požadavek za jiné SVJ", async () => {
    await expectDbError(create(w.ownerA, w.orgB), "PT403");
  });
});

describe("REQ-04 outbox a notifikace", () => {
  it("vytvoření zařadí notifikaci členům výboru (ne autorovi) bez textu požadavku", async () => {
    const r = await create(w.ownerA, w.orgA, "Tajný název požadavku");
    const rows = await w.db.admin<Record<string, unknown>>("select * from public.notification_outbox where request_id=$1", [r.id]);
    expect(rows.map((x) => x.recipient_user_id).sort()).toEqual([w.boardA, w.boardA2].sort());
    expect(rows.every((x) => x.status === "queued" && x.kind === "request_created")).toBe(true);
    expect(JSON.stringify(rows)).not.toContain("Tajný název");
  });
  it("selhání doručení e-mailu požadavek nevymaže", async () => {
    const r = await create(w.ownerA, w.orgA, "Odolnost vůči chybě e-mailu");
    await w.db.admin("update public.notification_outbox set status='failed', retry_count=1, last_error='smtp down' where request_id=$1", [r.id]);
    expect(await w.db.q(w.ownerA, "select id from public.requests where id=$1", [r.id])).toHaveLength(1);
    expect(await w.db.admin("select 1 from public.notification_outbox where request_id=$1 and status='failed'", [r.id])).not.toHaveLength(0);
  });
  it("outbox je čitelný jen pro výbor, ne pro autora", async () => {
    expect(await w.db.q(w.ownerA, "select * from public.notification_outbox")).toHaveLength(0);
    expect((await w.db.q(w.boardA, "select * from public.notification_outbox")).length).toBeGreaterThan(0);
  });
  it("změna stavu zařadí notifikaci autorovi; stejná notifikace se nezduplikuje", async () => {
    const r = await create(w.ownerA, w.orgA, "Notifikace stavu");
    await change(w.boardA, r.id, "triaged", ", null, $3", [w.technicalA]);
    const rows = await w.db.admin<{ kind: string; recipient_user_id: string }>("select kind, recipient_user_id from public.notification_outbox where request_id=$1 and kind in ('request_status','request_assigned')", [r.id]);
    expect(rows.map((x) => `${x.kind}:${x.recipient_user_id}`).sort()).toEqual([`request_assigned:${w.technicalA}`, `request_status:${w.ownerA}`].sort());
  });
});

describe("T-REQ-02 stavový automat a práva", () => {
  it("nepovolený přechod new -> resolved je odmítnut a nic se nezmění", async () => {
    const r = await create(w.ownerA, w.orgA, "Přechody");
    const events = async () => (await w.db.admin<{ n: number }>("select count(*)::int n from public.request_events where request_id=$1", [r.id]))[0].n;
    const before = await events();
    await expectDbError(change(w.boardA, r.id, "resolved"), "PT422");
    expect(await status(r.id)).toBe("new");
    expect(await events()).toBe(before);
  });
  it("zařazení vyžaduje řešitele nebo důvod nepřiřazení", async () => {
    const r = await create(w.ownerA, w.orgA, "Zařazení");
    await expectDbError(change(w.boardA, r.id, "triaged"), "PT422");
    await change(w.boardA, r.id, "triaged", ", $3", ["Čeká se na posudek, bez řešitele"]);
    expect(await status(r.id)).toBe("triaged");
  });
  it("zamítnutí a duplicita vyžadují vysvětlení; duplicita jen s požadavkem téhož SVJ", async () => {
    const main = await create(w.ownerA, w.orgA, "Hlavní");
    const dup = await create(w.ownerA, w.orgA, "Duplicitní");
    const foreign = await create(w.ownerB, w.orgB, "Cizí SVJ");
    await expectDbError(change(w.boardA, dup.id, "rejected"), "PT422");
    await expectDbError(change(w.boardA, dup.id, "duplicate", ", $3, null, null, null, $4", ["Stejné", foreign.id]), "PT422");
    await expectDbError(change(w.boardA, dup.id, "duplicate", ", $3", ["bez odkazu"]), "PT422");
    await change(w.boardA, dup.id, "duplicate", ", $3, null, null, null, $4", ["Stejná závada", main.id]);
    expect(await status(dup.id)).toBe("duplicate");
  });
  it("vyřešení vyžaduje výsledek a původní hodnotu nelze obejít prázdným řetězcem", async () => {
    const r = await create(w.ownerA, w.orgA, "Vyřešení");
    await change(w.boardA, r.id, "triaged", ", null, $3", [w.technicalA]);
    await change(w.boardA, r.id, "in_progress");
    await expectDbError(change(w.boardA, r.id, "resolved", ", null, null, null, $3", ["   "]), "PT422");
    await change(w.boardA, r.id, "resolved", ", null, null, null, $3", ["Vyměněn ohřívač"]);
    expect(await status(r.id)).toBe("resolved");
  });
  it("autor sám stav nemění a jiný vlastník požadavek nevidí", async () => {
    const r = await create(w.ownerA, w.orgA, "Autor nemění");
    await expectDbError(change(w.ownerA, r.id, "triaged", ", $3", ["x"]), "PT403");
    await expectDbError(change(w.ownerA2, r.id, "triaged", ", $3", ["x"]), "PT404");
  });
  it("zastaralá row_version vrátí konflikt a nic nezmění", async () => {
    const r = await create(w.ownerA, w.orgA, "Souběh");
    await expectDbError(w.db.rpc(w.boardA, "public.change_request_status($1, 'triaged', 99, 'důvod')", [r.id]), "PT409");
    expect(await status(r.id)).toBe("new");
  });
  it("přidělený řešitel pracuje, ale neuzavírá, nepřiděluje a nemění prioritu", async () => {
    const r = await create(w.ownerA, w.orgA, "Řešitel");
    await change(w.boardA, r.id, "triaged", ", null, $3", [w.technicalA]);
    await expectDbError(change(w.technicalA, r.id, "rejected", ", $3", ["x"]), "PT403");
    await change(w.technicalA, r.id, "in_progress");
    await expectDbError(change(w.technicalA, r.id, "waiting", ", null, $3", [w.managerA]), "PT403");
    await change(w.technicalA, r.id, "resolved", ", null, null, null, $3", ["Hotovo"]);
    await expectDbError(change(w.technicalA, r.id, "closed"), "PT403");
    await change(w.boardA, r.id, "closed");
    expect(await status(r.id)).toBe("closed");
  });
  it("jiný technik, který řešitel není, požadavek nevidí ani nemění", async () => {
    const r = await create(w.ownerA, w.orgA, "Cizí technik");
    expect(await w.db.q(w.technicalA, "select id from public.requests where id=$1", [r.id])).toHaveLength(0);
    await expectDbError(change(w.technicalA, r.id, "in_progress"), "PT404");
  });
  it("řešitel musí být aktivní člen téhož SVJ", async () => {
    const r = await create(w.ownerA, w.orgA, "Řešitel cizí");
    await expectDbError(change(w.boardA, r.id, "triaged", ", null, $3", [w.ownerB]), "PT422");
    await expectDbError(change(w.boardA, r.id, "triaged", ", null, $3", [w.suspendedA]), "PT422");
  });
});

describe("Komentáře, interní poznámky a znovuotevření", () => {
  it("interní poznámka není vidět autorovi, veřejný komentář ano", async () => {
    const r = await create(w.ownerA, w.orgA, "Poznámky");
    await w.db.rpc(w.boardA, "public.add_request_comment($1, 'Interní úvaha výboru', true)", [r.id]);
    await w.db.rpc(w.boardA, "public.add_request_comment($1, 'Dobrý den, řešíme', false)", [r.id]);
    const authorSees = (await w.db.q<{ note: string }>(w.ownerA, "select note from public.request_events where request_id=$1 and note is not null", [r.id])).map((x) => x.note);
    expect(authorSees).toEqual(["Dobrý den, řešíme"]);
    expect((await w.db.q(w.boardA, "select 1 from public.request_events where request_id=$1 and internal", [r.id]))).toHaveLength(1);
  });
  it("autor nemůže psát interní poznámky a cizí vlastník nemůže komentovat", async () => {
    const r = await create(w.ownerA, w.orgA, "Komentáře");
    await expectDbError(w.db.rpc(w.ownerA, "public.add_request_comment($1, 'x', true)", [r.id]), "PT403");
    await expectDbError(w.db.rpc(w.ownerA2, "public.add_request_comment($1, 'x', false)", [r.id]), "PT404");
    await w.db.rpc(w.ownerA, "public.add_request_comment($1, 'Doplnění od autora', false)", [r.id]);
  });
  it("autor může požádat o znovuotevření jen vyřešeného požadavku a s důvodem", async () => {
    const r = await create(w.ownerA, w.orgA, "Znovuotevření");
    await expectDbError(w.db.rpc(w.ownerA, "public.request_reopen($1, 'Pořád teče', $2)", [r.id, await version(r.id)]), "PT422");
    await change(w.boardA, r.id, "triaged", ", null, $3", [w.technicalA]);
    await change(w.boardA, r.id, "in_progress");
    await change(w.boardA, r.id, "resolved", ", null, null, null, $3", ["Opraveno"]);
    await expectDbError(w.db.rpc(w.ownerA, "public.request_reopen($1, '', $2)", [r.id, await version(r.id)]), "PT422");
    await w.db.rpc(w.ownerA, "public.request_reopen($1, 'Pořád teče', $2)", [r.id, await version(r.id)]);
    expect(await status(r.id)).toBe("new");
    expect((await w.db.admin<{ resolution_text: string | null }>("select resolution_text from public.requests where id=$1", [r.id]))[0].resolution_text).toBeNull();
  });
  it("historie událostí je neměnná a změny se zapisují do auditu", async () => {
    const r = await create(w.ownerA, w.orgA, "Audit");
    await expectDbError(w.db.admin("update public.request_events set note='x' where request_id=$1", [r.id]), "PT403");
    const audit = await w.db.admin("select 1 from public.audit_events where object_type='requests' and object_id=$1", [r.id]);
    expect(audit.length).toBeGreaterThan(0);
  });
  it("jména pro frontu vrací RPC jen výboru a řešiteli", async () => {
    const r = await create(w.ownerA, w.orgA, "Jména");
    const rows = await w.db.q(w.boardA, "select * from public.request_people(array[$1]::uuid[])", [r.id]);
    expect(rows.length).toBeGreaterThan(0);
    expect(await w.db.q(w.ownerA2, "select * from public.request_people(array[$1]::uuid[])", [r.id])).toHaveLength(0);
  });
});

describe("Omezení počtu požadavků", () => {
  it("jedenáctý požadavek autora za hodinu je odmítnut", async () => {
    for (let i = 0; i < 10; i++) await create(w.ownerA2, w.orgA, `Limit ${i}`);
    await expectDbError(create(w.ownerA2, w.orgA, "Limit navíc"), "PT429");
  });
});
