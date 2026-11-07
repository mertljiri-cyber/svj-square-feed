import { describe, it, beforeAll } from "vitest";
import { buildWorld, World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
beforeAll(async () => { w = await buildWorld(); });

describe("EXECUTE na funkcích", () => {
  it("anon nemůže volat žádné veřejné RPC", async () => {
    await expectDbError(w.db.rpc(null, "public.my_context()"), "42501");
    await expectDbError(w.db.rpc(null, "public.submit_form($1, '{}')", [w.forms.feedback]), "42501");
    await expectDbError(w.db.rpc(null, "public.submit_intent($1, 'Záměr', 'x', null)", [w.orgA]), "42501");
    await expectDbError(w.db.rpc(null, "public.accept_invitation('x')"), "42501");
    await expectDbError(w.db.rpc(null, "public.list_members($1)", [w.orgA]), "42501");
  });
  it("přihlášený uživatel nemůže volat interní funkce ze schématu app", async () => {
    await expectDbError(w.db.rpc(w.boardA, "app.bootstrap_first_board($1, $2, 'pokus o eskalaci')", [w.orgA, w.ownerA]), "42501");
    await expectDbError(w.db.rpc(w.boardA, "app.log_event($1, 'x', 'x', 'x', '{}')", [w.orgA]), "42501");
    await expectDbError(w.db.rpc(w.boardA, "app.enforce_rate_limit('x', 1, interval '1 hour')"), "42501");
  });
  it("přihlášený uživatel nemůže číst evidenci rate limitu", async () => {
    await expectDbError(w.db.q(w.boardA, "select * from app.rate_events"), "42501");
  });
});

describe("Omezení počtu požadavků", () => {
  it("jedenáctý záměr za hodinu je odmítnut", async () => {
    for (let i = 0; i < 10; i++) await w.db.rpc(w.ownerA2, "public.submit_intent($1, $2, 'popis', null)", [w.orgA, `Záměr číslo ${i}`]);
    await expectDbError(w.db.rpc(w.ownerA2, "public.submit_intent($1, 'Záměr navíc', 'x', null)", [w.orgA]), "PT429");
  });
});
