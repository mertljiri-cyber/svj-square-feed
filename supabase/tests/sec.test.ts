import { describe, it, expect, beforeAll } from "vitest";
import { buildWorld, World, membershipId } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
beforeAll(async () => { w = await buildWorld(); });

describe("T-SEC-01 anon čte jen výslovně veřejné publikované novinky", () => {
  it("anon vidí výslovně veřejnou publikovanou novinku, ale ne interní ani koncept", async () => {
    const rows = await w.db.q<{ title: string; status: string; visibility: string }>(null, "select title, status, visibility from public.news");
    expect(rows.map((r) => r.title)).toContain("Veřejná novinka");
    expect(rows.every((r) => r.status === "published" && r.visibility === "public")).toBe(true);
  });
  it("přímé čtení konceptu ani interní publikované novinky anonem nevrátí nic navíc", async () => {
    const rows = await w.db.q(null, "select id from public.news where title in ('Koncept novinky','Novinka pro vlastníky')");
    expect(rows).toHaveLength(0);
  });
});

describe("T-SEC-02 anon nečte interní data a nevkládá záznamy", () => {
  it("anon nečte forms, settings (kromě veřejných) a intents", async () => {
    await expectDbError(w.db.q(null, "select * from public.forms"), "42501");
    await expectDbError(w.db.q(null, "select * from public.intents"), "42501");
    const s = await w.db.q<{ key: string }>(null, "select key from public.settings");
    expect(s.map((r) => r.key)).not.toContain("internal_note");
  });
  it("anon nemůže vložit záměr ani podání přímým INSERTem", async () => {
    await expectDbError(w.db.q(null, "insert into public.intents (organization_id,title) values ($1,'x')", [w.orgA]), "42501");
    await expectDbError(w.db.q(null, "insert into public.form_submissions (organization_id, form_id, data) values ($1,$2,'{}')", [w.orgA, w.forms.feedback]), "42501");
  });
});

describe("T-SEC-03 vlastník nemění role, organizaci, autora ani stav schválení", () => {
  it("vlastník nesmí přímo vložit členství ani roli", async () => {
    const [m] = await w.db.admin<{ id: string }>("select id from public.memberships where user_id = $1 and organization_id = $2", [w.ownerA, w.orgA]);
    await expectDbError(w.db.q(w.ownerA, "insert into public.membership_roles (organization_id, membership_id, role) values ($1,$2,'board')", [w.orgA, m.id]), "42501");
    await expectDbError(w.db.q(w.ownerA, "update public.memberships set status = 'active' where id = $1", [m.id]), "42501");
  });
  it("vlastník nepřidělí board roli přes RPC", async () => {
    const m = await membershipId(w.db, w.orgA, w.ownerA);
    await expectDbError(w.db.rpc(w.ownerA, "public.grant_role($1, 'board')", [m]), "PT403");
  });
  it("vlastník nesmí změnit organization_id záměru ani stav přímým UPDATE", async () => {
    await expectDbError(w.db.q(w.ownerA, "update public.intents set organization_id = $1", [w.orgB]), "42501");
    await expectDbError(w.db.q(w.ownerA, "update public.intents set status = 'schvaleno'"), "42501");
  });
  it("uživatel nemůže změnit user_id profilu", async () => {
    await expectDbError(w.db.q(w.ownerA, "update public.profiles set user_id = $1 where user_id = $1", [w.ownerA]), "42501");
  });
  it("registrační metadata nepřidělí roli", async () => {
    const u = await w.db.createUser("meta.attack@example.test", { meta: { role: "board", roles: ["board"] } });
    const roles = await w.db.admin("select r.role from public.membership_roles r join public.memberships m on m.id = r.membership_id where m.user_id = $1", [u]);
    expect(roles).toHaveLength(0);
  });
});

describe("T-SEC-04 uživatel jiného SVJ nevidí ani nepropojí cizí data", () => {
  it("vlastník SVJ A nevidí interní novinku SVJ B", async () => {
    const rows = await w.db.q<{ title: string }>(w.ownerA, "select title from public.news");
    expect(rows.map((r) => r.title)).not.toContain("Interní novinka SVJ B");
  });
  it("vlastník SVJ B nevidí intents SVJ A a nemůže podat formulář SVJ A", async () => {
    const rows = await w.db.q(w.ownerB, "select id from public.intents where organization_id = $1", [w.orgA]);
    expect(rows).toHaveLength(0);
    await expectDbError(w.db.rpc(w.ownerB, "public.submit_form($1, '{}')", [w.forms.feedback]), "PT404");
  });
  it("podání nelze propojit s formulářem jiného SVJ přímým INSERTem", async () => {
    await expectDbError(
      w.db.q(w.boardB, "insert into public.form_submissions (organization_id, form_id, data) values ($1,$2,'{}')", [w.orgB, w.forms.feedback]),
      ["42501", "23503"],
    );
  });
});

describe("T-SEC-05 pozastavený člen se starým tokenem nečte interní data", () => {
  it("suspendovaný člen nevidí intents ani archiv přes RLS", async () => {
    const rows = await w.db.q(w.suspendedA, "select id from public.intents");
    expect(rows).toHaveLength(0);
    await expectDbError(w.db.rpc(w.suspendedA, "public.submit_intent($1, 'Záměr', 'x', null)", [w.orgA]), "PT403");
  });
  it("čekající člen (nepotvrzený) nemá interní přístup", async () => {
    await expectDbError(w.db.rpc(w.pendingA, "public.submit_intent($1, 'Záměr', 'x', null)", [w.orgA]), "PT403");
  });
});

describe("T-SEC-06 konflikt verze a atomické změny", () => {
  it("neplatná row_version vrátí konflikt a nic nezmění", async () => {
    const [i] = await w.db.admin<{ id: string; status: string }>("insert into public.intents (organization_id,title) values ($1,'Pro souběh') returning id, status", [w.orgA]);
    await expectDbError(w.db.rpc(w.boardA, "public.change_intent_status($1, 'projednava-se', 99)", [i.id]), "PT409");
    const [after] = await w.db.admin<{ status: string }>("select status from public.intents where id = $1", [i.id]);
    expect(after.status).toBe("navrh");
  });
  it("nepovolený přechod stavu záměru je odmítnut", async () => {
    const [i] = await w.db.admin<{ id: string }>("insert into public.intents (organization_id,title) values ($1,'Přechod') returning id", [w.orgA]);
    await expectDbError(w.db.rpc(w.boardA, "public.change_intent_status($1, 'hotovo', 1)", [i.id]), "PT422");
  });
  it("audit a změna jsou ve stejné transakci: neúspěch nezanechá záznam", async () => {
    const before = await w.db.admin<{ n: number }>("select count(*)::int n from public.audit_events");
    await expectDbError(w.db.rpc(w.boardA, "public.set_membership_status(gen_random_uuid(), 'active', 1)"), "PT404");
    const after = await w.db.admin<{ n: number }>("select count(*)::int n from public.audit_events");
    expect(after[0].n).toBe(before[0].n);
  });
  it("audit nejde měnit ani mazat", async () => {
    await expectDbError(w.db.admin("update public.audit_events set action = 'x'"), "PT403");
    await expectDbError(w.db.admin("delete from public.audit_events"), "PT403");
  });
});

describe("Role, delegace a poslední board", () => {
  it("nelze odebrat posledního aktivního člena výboru", async () => {
    const m = await membershipId(w.db, w.orgB, w.boardB);
    await expectDbError(w.db.rpc(w.boardB, "public.set_membership_status($1, 'suspended', 2)", [m]), "PT409");
  });
  it("manager s delegací news:write smí upravit novinku, ale nesmí publikovat bez approve", async () => {
    await w.db.admin("insert into public.news (organization_id, title, status, visibility) values ($1,'Koncept managera','draft','owners')", [w.orgA]);
    await w.db.q(w.managerA, "update public.news set title = 'Upraveno' where title = 'Koncept managera'");
    await expectDbError(
      w.db.q(w.managerA, "update public.news set status = 'published', visibility = 'public' where title = 'Upraveno'"),
      "PT403",
    );
  });
  it("technik bez schvalovací role nemůže změnit stav záměru", async () => {
    const [i] = await w.db.admin<{ id: string }>("insert into public.intents (organization_id,title) values ($1,'Technik') returning id", [w.orgA]);
    await expectDbError(w.db.rpc(w.technicalA, "public.change_intent_status($1, 'projednava-se', 1)", [i.id]), "PT403");
  });
  it("systémová role se z aplikace nepřiděluje", async () => {
    const m = await membershipId(w.db, w.orgA, w.ownerA2);
    await expectDbError(w.db.rpc(w.boardA, "public.grant_role($1, 'system_admin')", [m]), "PT403");
  });
});

describe("Seznam členů je jen pro výbor", () => {
  it("běžný vlastník nevidí e-maily členů", async () => {
    await expectDbError(w.db.rpc(w.ownerA, "public.list_members($1)", [w.orgA]), "PT403");
  });
  it("board vidí členy své organizace", async () => {
    const rows = await w.db.q(w.boardA, "select * from public.list_members($1)", [w.orgA]);
    expect(rows.length).toBeGreaterThan(3);
  });
});
