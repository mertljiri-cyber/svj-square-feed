import { describe, it, expect, beforeAll } from "vitest";
import { buildWorld, World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";

let w: World;
beforeAll(async () => { w = await buildWorld(); });

describe("Pozvánky", () => {
  it("board vytvoří pozvánku; v databázi je uložen jen hash tokenu", async () => {
    const res = await w.db.rpc<{ token: string; invitation_id: string }>(w.boardA, "public.create_invitation($1, 'new.owner@example.test', 'owner', 7)", [w.orgA]);
    const [row] = await w.db.admin<{ token_hash: string }>("select token_hash from public.invitations where id = $1", [res.invitation_id]);
    expect(row.token_hash).not.toContain(res.token);
    expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
  });
  it("přijetí cizím účtem s jiným e-mailem selže jednotnou chybou", async () => {
    const res = await w.db.rpc<{ token: string }>(w.boardA, "public.create_invitation($1, 'bound@example.test', 'owner', 7)", [w.orgA]);
    await expectDbError(w.db.rpc(w.outsider, "public.accept_invitation($1)", [res.token]), "PT404");
  });
  it("přijetí nevytvoří aktivní členství; interní přístup až po schválení", async () => {
    const user = await w.db.createUser("bound@example.test");
    const inv = await w.db.rpc<{ token: string }>(w.boardA, "public.create_invitation($1, 'bound@example.test', 'owner', 7)", [w.orgA]);
    const acc = await w.db.rpc<{ status: string; membership_id: string }>(user, "public.accept_invitation($1)", [inv.token]);
    expect(acc.status).toBe("invited");
    expect(await w.db.q(user, "select id from public.news where visibility = 'owners'")).toHaveLength(0);
  });
  it("použitá pozvánka nejde přijmout znovu", async () => {
    const user = await w.db.createUser("reuse@example.test");
    const inv = await w.db.rpc<{ token: string }>(w.boardA, "public.create_invitation($1, 'reuse@example.test', 'owner', 7)", [w.orgA]);
    await w.db.rpc(user, "public.accept_invitation($1)", [inv.token]);
    await expectDbError(w.db.rpc(user, "public.accept_invitation($1)", [inv.token]), "PT404");
  });
  it("prošlá pozvánka je odmítnuta", async () => {
    const user = await w.db.createUser("late@example.test");
    const inv = await w.db.rpc<{ token: string; invitation_id: string }>(w.boardA, "public.create_invitation($1, 'late@example.test', 'owner', 1)", [w.orgA]);
    await w.db.admin("update public.invitations set expires_at = now() - interval '1 minute' where id = $1", [inv.invitation_id]);
    await expectDbError(w.db.rpc(user, "public.accept_invitation($1)", [inv.token]), "PT404");
  });
  it("vlastník nesmí vytvořit pozvánku ani nastavit roli board", async () => {
    await expectDbError(w.db.rpc(w.ownerA, "public.create_invitation($1, 'x@example.test', 'owner', 7)", [w.orgA]), "PT403");
    await expectDbError(w.db.rpc(w.boardA, "public.create_invitation($1, 'x@example.test', 'system_admin', 7)", [w.orgA]), "PT422");
  });
  it("pozastavený člen nemůže znovu přijmout pozvánku a získat přístup", async () => {
    const inv = await w.db.rpc<{ token: string }>(w.boardA, "public.create_invitation($1, 'suspended.a@example.test', 'owner', 7)", [w.orgA]);
    const suspended = (await w.db.admin<{ user_id: string }>("select user_id from public.memberships m join auth.users u on u.id=m.user_id where u.email='suspended.a@example.test'"))[0].user_id;
    await expectDbError(w.db.rpc(suspended, "public.accept_invitation($1)", [inv.token]), "PT404");
  });
  it("odvolání pozvánky ji zneplatní", async () => {
    const user = await w.db.createUser("revoked@example.test");
    const inv = await w.db.rpc<{ token: string; invitation_id: string }>(w.boardA, "public.create_invitation($1, 'revoked@example.test', 'owner', 7)", [w.orgA]);
    await w.db.rpc(w.boardA, "public.revoke_invitation($1)", [inv.invitation_id]);
    await expectDbError(w.db.rpc(user, "public.accept_invitation($1)", [inv.token]), "PT404");
  });
});
