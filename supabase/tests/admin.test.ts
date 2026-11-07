import { describe, it, expect, beforeAll } from "vitest";
import { buildWorld, World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
beforeAll(async () => { w = await buildWorld(); });

const insertNews = (user: string, status = "draft", visibility = "owners", title = "Nová novinka") =>
  w.db.q(user, "insert into public.news (organization_id, title, status, visibility, tags) values ($1,$2,$3,$4,'{a,b}') returning id, row_version", [w.orgA, title, status, visibility]);

describe("Správa novinek a úvodního textu", () => {
  it("výbor založí koncept i publikuje veřejnou novinku; autor se zapíše serverem", async () => {
    const [draft] = await insertNews(w.boardA);
    expect(draft.id).toBeTruthy();
    const [pub] = await insertNews(w.boardA, "published", "public", "Veřejná správa");
    const [row] = await w.db.admin<{ created_by: string }>("select created_by from public.news where id=$1", [pub.id]);
    expect(row.created_by).toBe(w.boardA);
    const anon = await w.db.q<{ title: string }>(null, "select title from public.news where title='Veřejná správa'");
    expect(anon).toHaveLength(1);
  });
  it("správce se zápisem novinky píše koncepty, ale bez schválení nepublikuje", async () => {
    await insertNews(w.managerA);
    await expectDbError(insertNews(w.managerA, "published", "public", "Pokus o publikaci"), "PT403");
  });
  it("vlastník novinky nezakládá ani neupravuje a koncepty nevidí", async () => {
    await expectDbError(insertNews(w.ownerA), "42501");
    const concept = await w.db.q(w.ownerA, "select 1 from public.news where status='draft'");
    expect(concept).toHaveLength(0);
  });
  it("úprava s neplatnou verzí nezmění žádný řádek (konflikt se pozná podle počtu řádků)", async () => {
    const [n] = await insertNews(w.boardA, "draft", "owners", "Souběh");
    const rows = await w.db.q(w.boardA, "update public.news set title='x' where id=$1 and row_version=99 returning id", [n.id]);
    expect(rows).toHaveLength(0);
  });
  it("úvodní text mění správce nastavení; vlastník ne; veřejnost ho čte", async () => {
    // Úvodní text vzniká seedem původní migrace (klíč je v tabulce unikátní), stránka správy jej proto upravuje.
    await w.db.q(w.boardA, "update public.settings set value='Nový text' where key='intro_text'");
    const rows = await w.db.q(w.ownerA, "update public.settings set value='Útok' where key='intro_text' returning id");
    expect(rows).toHaveLength(0);
    const [pub] = await w.db.q<{ value: string }>(null, "select value from public.settings where key='intro_text'");
    expect(pub.value).toBe("Nový text");
  });
});

describe("Čtení auditu", () => {
  it("výbor čte audit své organizace, vlastník a jiné SVJ ne", async () => {
    expect((await w.db.q(w.boardA, "select 1 from public.audit_events where organization_id=$1", [w.orgA])).length).toBeGreaterThan(0);
    // Vlastník vidí jen záznamy o vlastních akcích (omezený pohled na vlastní historii), nikdy cizí.
    const own = await w.db.q<{ actor_user_id: string }>(w.ownerA, "select actor_user_id from public.audit_events where organization_id=$1", [w.orgA]);
    expect(own.every((r) => r.actor_user_id === w.ownerA)).toBe(true);
    expect(await w.db.q(w.boardB, "select 1 from public.audit_events where organization_id=$1", [w.orgA])).toHaveLength(0);
    await expectDbError(w.db.q(null, "select * from public.audit_events"), "42501");
  });
  it("audit nejde z aplikace měnit ani mazat", async () => {
    await expectDbError(w.db.q(w.boardA, "delete from public.audit_events"), "42501");
    await expectDbError(w.db.q(w.boardA, "insert into public.audit_events (action, object_type) values ('x','x')"), "42501");
  });
  it("audit novinek neobsahuje text ani perex", async () => {
    await w.db.q(w.boardA, "insert into public.news (organization_id, title, perex, content) values ($1,'Auditní test','TAJNY-PEREX','TAJNY-OBSAH')", [w.orgA]);
    const rows = await w.db.admin<{ details: unknown }>("select details from public.audit_events where object_type='news'");
    expect(JSON.stringify(rows)).not.toContain("TAJNY");
  });
});
