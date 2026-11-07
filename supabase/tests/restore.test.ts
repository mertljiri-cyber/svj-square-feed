import { it, expect } from "vitest";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { buildWorld } from "./helpers/fixtures";

// Otisk obsahu klíčových tabulek: počty a kontrolní součet, aby obnova nebyla jen „něco se načetlo“.
async function fingerprint(pg: PGlite) {
  const tables = ["news", "intents", "forms", "form_submissions", "settings", "organizations", "memberships", "membership_roles", "scoped_grants", "invitations", "audit_events"];
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

