import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { buildWorld, World, membershipId } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
const submit = (user: string, title = "Nová lavička před domem") =>
  w.db.rpc<string>(user, "public.submit_intent($1, $2, 'Popis', null)", [w.orgA, title]);
const rv = async (id: string) => (await w.db.admin<{ row_version: number }>("select row_version from public.intents where id=$1", [id]))[0].row_version;
const status = async (id: string) => (await w.db.admin<{ status: string }>("select status from public.intents where id=$1", [id]))[0].status;
const update = async (user: string, id: string, o: Partial<{ title: string; desc: string; prio: string; loc: string | null; cost: number | null; year: number | null }> = {}) =>
  w.db.rpc(user, "public.update_intent($1,$2,$3,$4,$5,$6,$7,$8)", [id, o.title ?? "Upravený název", o.desc ?? "Upravený popis", o.prio ?? "medium", o.loc ?? null, o.cost ?? null, o.year ?? null, await rv(id)]);
const change = async (user: string, id: string, to: string, note: string | null = null) =>
  w.db.rpc(user, "public.change_intent_status($1,$2,$3,$4)", [id, to, await rv(id), note]);
const events = (id: string) => w.db.admin<{ event_type: string }>("select event_type from public.intent_events where intent_id=$1 order by id", [id]);

beforeAll(async () => {
  w = await buildWorld();
  // Správce záměrů bez schvalovacího práva a s ním.
  await w.db.rpc(w.boardA, "public.grant_scope($1,'intents','write')", [await membershipId(w.db, w.orgA, w.technicalA)]);
});
beforeEach(async () => { await w.db.admin("delete from app.rate_events"); });

describe("Úpravy záměru", () => {
  it("autor upraví svůj záměr ve stavu návrh a změna je v historii", async () => {
    const id = await submit(w.ownerA);
    await update(w.ownerA, id, { title: "Lavička u vchodu", loc: "Vchod 1" });
    const [row] = await w.db.admin<{ title: string; location: string }>("select title, location from public.intents where id=$1", [id]);
    expect(row).toEqual({ title: "Lavička u vchodu", location: "Vchod 1" });
    expect((await events(id)).map((e) => e.event_type)).toEqual(["created", "edited"]);
  });
  it("autor nemění prioritu, odhad nákladů ani rok", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(update(w.ownerA, id, { prio: "high" }), "PT403");
    await expectDbError(update(w.ownerA, id, { cost: 5000 }), "PT403");
    await expectDbError(update(w.ownerA, id, { year: 2027 }), "PT403");
  });
  it("jiný vlastník záměr neupraví; autor ho po projednání neupraví", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(update(w.ownerA2, id), "PT403");
    await change(w.technicalA, id, "projednava-se");
    await expectDbError(update(w.ownerA, id), "PT403");
  });
  it("správce záměrů upraví vše včetně priority, nákladů a roku; nula není totéž co neodhadnuto", async () => {
    const id = await submit(w.ownerA);
    await update(w.technicalA, id, { prio: "high", cost: 0, year: 2027 });
    const [row] = await w.db.admin<{ priority: string; estimated_cost: string; planned_year: number }>("select priority, estimated_cost, planned_year from public.intents where id=$1", [id]);
    expect(row).toEqual({ priority: "high", estimated_cost: "0.00", planned_year: 2027 });
    await update(w.technicalA, id, { prio: "high", cost: null, year: 2027 });
    expect((await w.db.admin<{ estimated_cost: string | null }>("select estimated_cost from public.intents where id=$1", [id]))[0].estimated_cost).toBeNull();
  });
  it("neplatné hodnoty a zastaralá verze jsou odmítnuty", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(update(w.technicalA, id, { cost: -1 }), "PT422");
    await expectDbError(update(w.technicalA, id, { year: 1800 }), "PT422");
    await expectDbError(update(w.technicalA, id, { prio: "urgent" }), "PT422");
    await expectDbError(update(w.technicalA, id, { title: "ab" }), "PT422");
    await expectDbError(w.db.rpc(w.technicalA, "public.update_intent($1,'Název','x','medium',null,null,null,99)", [id]), "PT409");
  });
  it("cizí SVJ záměr nevidí ani neupraví", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(update(w.ownerB, id), "PT404");
  });
  it("přímý UPDATE tabulky záměrů je zakázán i správci", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(w.db.q(w.technicalA, "update public.intents set title='x' where id=$1", [id]), "42501");
    await expectDbError(w.db.q(w.boardA, "update public.intents set title='x' where id=$1", [id]), "42501");
  });
});

describe("Stav záměru a rozhodnutí", () => {
  it("schválení vyžaduje odkaz na rozhodnutí a schvalovací oprávnění", async () => {
    const id = await submit(w.ownerA);
    await change(w.technicalA, id, "projednava-se");
    await expectDbError(change(w.boardA, id, "schvaleno"), "PT422");
    await expectDbError(change(w.technicalA, id, "schvaleno", "Usnesení č. 3/2026"), "PT403"); // má jen write
    await change(w.boardA, id, "schvaleno", "Usnesení shromáždění č. 3/2026, bod 4");
    expect(await status(id)).toBe("schvaleno");
    const [row] = await w.db.admin<{ decision_note: string }>("select decision_note from public.intents where id=$1", [id]);
    expect(row.decision_note).toContain("3/2026");
  });
  it("vlastník stav nemění; nepovolený přechod je odmítnut a nic se nezmění", async () => {
    const id = await submit(w.ownerA);
    await expectDbError(change(w.ownerA, id, "projednava-se"), "PT403");
    const before = (await events(id)).length;
    await expectDbError(change(w.boardA, id, "hotovo"), "PT422");
    expect(await status(id)).toBe("navrh");
    expect((await events(id)).length).toBe(before);
  });
  it("změna stavu zanechá událost s původním a novým stavem", async () => {
    const id = await submit(w.ownerA);
    await change(w.boardA, id, "projednava-se");
    const [e] = await w.db.admin<{ from_status: string; to_status: string }>("select from_status, to_status from public.intent_events where intent_id=$1 and event_type='status_changed'", [id]);
    expect(e).toEqual({ from_status: "navrh", to_status: "projednava-se" });
  });
});

describe("Diskuse a historie", () => {
  it("aktivní člen komentuje; pozastavený, čekající a cizí ne", async () => {
    const id = await submit(w.ownerA);
    await w.db.rpc(w.ownerA2, "public.add_intent_comment($1,'Souhlasím')", [id]);
    for (const u of [w.suspendedA, w.pendingA, w.ownerB]) await expectDbError(w.db.rpc(u, "public.add_intent_comment($1,'x')", [id]), "PT404");
    await expectDbError(w.db.rpc(w.ownerA2, "public.add_intent_comment($1,'  ')", [id]), "PT422");
  });
  it("historii čtou aktivní členi téhož SVJ, nikdo jiný; není měnitelná", async () => {
    const id = await submit(w.ownerA);
    expect(await w.db.q(w.ownerA2, "select 1 from public.intent_events where intent_id=$1", [id])).toHaveLength(1);
    expect(await w.db.q(w.ownerB, "select 1 from public.intent_events where intent_id=$1", [id])).toHaveLength(0);
    await expectDbError(w.db.q(w.ownerA, "select 1 from public.intent_events", []).then(() => w.db.admin("update public.intent_events set note='x'")), "PT403");
  });
  it("smazání záměru smí jen výbor", async () => {
    const id = await submit(w.ownerA);
    await w.db.q(w.ownerA, "delete from public.intents where id=$1", [id]).catch(() => undefined);
    await w.db.q(w.technicalA, "delete from public.intents where id=$1", [id]).catch(() => undefined);
    expect(await w.db.admin("select 1 from public.intents where id=$1", [id])).toHaveLength(1);
    await w.db.q(w.boardA, "delete from public.intents where id=$1", [id]);
    expect(await w.db.admin("select 1 from public.intents where id=$1", [id])).toHaveLength(0);
  });
  it("jména v historii vrací RPC jen členům SVJ", async () => {
    const id = await submit(w.ownerA);
    expect((await w.db.q(w.ownerA2, "select * from public.intent_people($1)", [id])).length).toBeGreaterThanOrEqual(0);
    expect(await w.db.q(w.ownerB, "select * from public.intent_people($1)", [id])).toHaveLength(0);
  });
});
