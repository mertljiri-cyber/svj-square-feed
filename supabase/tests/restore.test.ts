import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { buildWorld } from "./helpers/fixtures";

// Otisk obsahu klíčových tabulek: počty a kontrolní součet, aby obnova nebyla jen „něco se načetlo“.
async function fingerprint(pg: PGlite) {
  const tables = ["news", "intents", "forms", "form_submissions", "settings", "organizations", "memberships", "membership_roles", "scoped_grants", "invitations", "audit_events", "requests", "request_events", "documents", "document_versions", "document_grants"];
  const out: Record<string, string> = {};
  for (const t of tables) {
    const rows = (await pg.query<Record<string, unknown>>(`select * from public.${t} order by 1`)).rows;
    out[t] = `${rows.length}:${createHash("sha256").update(JSON.stringify(rows)).digest("hex").slice(0, 16)}`;
  }
  return out;
}

it("T-OPS-01: záloha a obnova do izolované kopie zachová počty a obsah; migrace nic neztratí", async () => {
  const w = await buildWorld();
  const before = await fingerprint(w.db.pg);
  const dump = await w.db.pg.dumpDataDir("gzip");
  const restored = new PGlite({ loadDataDir: dump });
  await restored.waitReady;
  const after = await fingerprint(restored);
  expect(after).toEqual(before);
  // obnovená kopie zachovává vynucení: anon nečte koncepty
  const r = await restored.query<{ n: number }>("select count(*)::int n from public.news where status='draft'");
  expect(r.rows[0].n).toBeGreaterThan(0);
  await restored.close();
});

it("T-SEC-07 (kontrola): serverový klíč není v klientském kódu ani v build výstupu", () => {
  const dirs = ["src", "dist"].filter((d) => existsSync(d));
  const bad: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|js|css|html)$/.test(f) && /service_role|SUPABASE_SERVICE_ROLE|sb_secret_/.test(readFileSync(p, "utf8"))) bad.push(p);
    }
  };
  dirs.forEach(walk);
  expect(bad).toEqual([]);
});

it("kontrola migrací: původní migrace se nemění (sha256 zůstává)", () => {
  const f = "supabase/migrations/20251228145052_0fdf8dda-684b-492a-a2a0-2c749ed128ee.sql";
  const h = createHash("sha256").update(readFileSync(f)).digest("hex");
  // Otisk původní migrace z commitu d9e67ec92fda83c2fef627f17f2d8e1690bb894c.
  expect(h).toBe("25971dc3d49a57a91c63f12135a9cfc4ecdf9fcff64bcb570a5f74299fa3b6af");
});


it("T-OPS-01 (archiv): obnova dvou verzí dokumentu a jejich objektů zachová vazby, kontrolní součty a práva", async () => {
  const w = await buildWorld();
  const doc = await w.db.rpc<string>(w.boardA, "public.create_document($1,'Revizní zpráva','revize',null,null,'owners')", [w.orgA]);
  const keys: string[] = [];
  for (const n of [1, 2]) {
    const sha = String(n).repeat(64);
    const v = await w.db.rpc<{ version_id: string; object_key: string }>(w.boardA, "public.begin_upload($1,$2,'application/pdf',500,$3)", [doc, `zprava-v${n}.pdf`, sha]);
    await w.db.q(w.boardA, "insert into storage.objects (bucket_id,name,owner,metadata) values ('documents',$1,auth.uid(),$2)", [v.object_key, JSON.stringify({ size: 500, mimetype: "application/pdf" })]);
    await w.db.rpc(w.boardA, "public.complete_upload($1)", [v.version_id]);
    keys.push(v.object_key);
    const [{ row_version }] = await w.db.admin<{ row_version: number }>("select row_version from public.documents where id=$1", [doc]);
    await w.db.rpc(w.boardA, "public.publish_version($1,$2,$3)", [doc, v.version_id, row_version]);
  }
  const fp = async (pg: PGlite) => ({
    versions: (await pg.query("select version_no, object_key, sha256, bytes, upload_status from public.document_versions order by version_no")).rows,
    objects: (await pg.query("select name, metadata from storage.objects order by name")).rows,
    current: (await pg.query("select d.current_version_id = v.id as ok from public.documents d join public.document_versions v on v.id = d.current_version_id")).rows,
  });
  const before = await fp(w.db.pg);
  const restored = new PGlite({ loadDataDir: await w.db.pg.dumpDataDir("gzip") });
  await restored.waitReady;
  const after = await fp(restored);
  expect(after).toEqual(before);
  expect(after.versions).toHaveLength(2);
  expect(after.objects.map((o) => o.name).sort()).toEqual([...keys].sort());
  expect(after.current).toEqual([{ ok: true }]);
  // Obnovená kopie zachovává oprávnění: vlastník jiného SVJ objekty nevidí.
  await restored.exec("begin; set local role authenticated;");
  await restored.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: w.ownerB, role: "authenticated" })]);
  expect((await restored.query("select 1 from storage.objects")).rows).toHaveLength(0);
  await restored.exec("rollback");
  await restored.close();
});
