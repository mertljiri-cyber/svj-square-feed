import { PILOT_ORG, TestDb, createDb } from "./db";

export const ORG_B = "00000000-0000-4000-8000-0000000000b2";

/** Syntetické osoby podle 10_TESTOVANI_A_RELEASE.md; žádné skutečné účty ani adresy. */
export type World = {
  db: TestDb;
  orgA: string;
  orgB: string;
  boardA: string;
  boardA2: string;
  ownerA: string;
  ownerA2: string;
  managerA: string;
  technicalA: string;
  pendingA: string;
  suspendedA: string;
  outsider: string;
  ownerB: string;
  boardB: string;
  forms: { intent: string; feedback: string; survey: string };
};

async function inviteAndJoin(db: TestDb, board: string, org: string, email: string, role = "owner", approve = true) {
  const user = await db.createUser(email);
  const inv = await db.rpc<{ token: string }>(board, "public.create_invitation($1, $2, $3)", [org, email, role]);
  const accepted = await db.rpc<{ membership_id: string }>(user, "public.accept_invitation($1)", [inv.token]);
  if (approve) {
    await db.rpc(board, "public.set_membership_status($1, 'active', 1)", [accepted.membership_id]);
  }
  return { user, membershipId: accepted.membership_id };
}

export async function membershipId(db: TestDb, org: string, user: string): Promise<string> {
  const [row] = await db.admin<{ id: string }>("select id from public.memberships where organization_id = $1 and user_id = $2", [org, user]);
  return row.id;
}

export async function buildWorld(): Promise<World> {
  const db = await createDb();
  await db.admin("insert into public.organizations (id, name) values ($1, 'Testovací SVJ B')", [ORG_B]);

  const boardA = await db.createUser("board.a@example.test");
  await db.admin("select app.bootstrap_first_board($1, $2, 'testovací bootstrap')", [PILOT_ORG, boardA]);
  const boardB = await db.createUser("board.b@example.test");
  await db.admin("select app.bootstrap_first_board($1, $2, 'testovací bootstrap')", [ORG_B, boardB]);

  const { user: boardA2 } = await inviteAndJoin(db, boardA, PILOT_ORG, "board2.a@example.test", "board");
  const { user: ownerA } = await inviteAndJoin(db, boardA, PILOT_ORG, "owner.a@example.test");
  const { user: ownerA2 } = await inviteAndJoin(db, boardA, PILOT_ORG, "owner2.a@example.test");
  const { user: managerA, membershipId: managerMembership } = await inviteAndJoin(db, boardA, PILOT_ORG, "manager.a@example.test", "manager");
  await db.rpc(boardA, "public.grant_scope($1, 'news', 'write')", [managerMembership]);
  const { user: technicalA } = await inviteAndJoin(db, boardA, PILOT_ORG, "tech.a@example.test", "technical");
  const { user: pendingA } = await inviteAndJoin(db, boardA, PILOT_ORG, "pending.a@example.test", "owner", false);
  const { user: suspendedA, membershipId: suspendedMembership } = await inviteAndJoin(db, boardA, PILOT_ORG, "suspended.a@example.test");
  await db.rpc(boardA, "public.set_membership_status($1, 'suspended', 2)", [suspendedMembership]);
  const outsider = await db.createUser("outsider@example.test");
  const { user: ownerB } = await inviteAndJoin(db, boardB, ORG_B, "owner.b@example.test");

  // Obsah: veřejná publikovaná, interní publikovaná a rozpracovaná novinka; interní nastavení.
  await db.admin(`insert into public.news (organization_id, title, status, visibility) values
    ($1, 'Veřejná novinka', 'published', 'public'),
    ($1, 'Novinka pro vlastníky', 'published', 'owners'),
    ($1, 'Koncept novinky', 'draft', 'owners'),
    ($2, 'Interní novinka SVJ B', 'published', 'owners')`, [PILOT_ORG, ORG_B]);
  await db.admin("insert into public.settings (organization_id, key, value) values ($1, 'internal_note', 'interní')", [PILOT_ORG]);
  await db.admin("insert into public.intents (organization_id, title, proposer_name) values ($1, 'Záměr SVJ B', 'Test B')", [ORG_B]);
  await db.admin(`insert into public.forms (organization_id, title, fields, submit_target, active) values
    ($1, 'Neaktivní formulář', '[]', 'feedback', false)`, [PILOT_ORG]);

  const formRows = await db.admin<{ id: string; submit_target: string }>(
    "select id, submit_target from public.forms where organization_id = $1 and active", [PILOT_ORG]);
  const forms = Object.fromEntries(formRows.map((r) => [r.submit_target, r.id])) as World["forms"];

  return { db, orgA: PILOT_ORG, orgB: ORG_B, boardA, boardA2, ownerA, ownerA2, managerA, technicalA, pendingA, suspendedA, outsider, ownerB, boardB, forms };
}
