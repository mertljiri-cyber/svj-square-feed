import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { expect } from "vitest";

export const MIGRATIONS_DIR = join(__dirname, "..", "..", "migrations");
export const PILOT_ORG = "00000000-0000-4000-8000-000000000001";

/**
 * Minimální náhrada prostředí Supabase pro integrační testy oprávnění:
 * role anon/authenticated/service_role, schéma auth s auth.uid() z request.jwt.claims
 * a výchozí granty, které Supabase dává novým objektům ve schématu public.
 * Nejde o celý Supabase; Auth, PostgREST a Storage se zde neověřují.
 */
const SUPABASE_STUB = `
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;

create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  email_confirmed_at timestamptz,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid
$$;
create function auth.role() returns text language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'
$$;
create function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;

grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

export type Row = Record<string, unknown>;
export type Query = <T extends Row = Row>(sql: string, params?: unknown[]) => Promise<T[]>;

export class TestDb {
  constructor(public readonly pg: PGlite) {}

  /** Dotaz jako vlastník databáze (provozní správce), mimo RLS. */
  admin: Query = async (sql, params) => (await this.pg.query(sql, params)).rows as never;

  async createUser(email: string, opts: { confirmed?: boolean; meta?: Row } = {}): Promise<string> {
    const [row] = await this.admin<{ id: string }>(
      "insert into auth.users (email, email_confirmed_at, raw_user_meta_data) values ($1, $2, $3) returning id",
      [email, opts.confirmed === false ? null : new Date().toISOString(), JSON.stringify(opts.meta ?? {})],
    );
    return row.id;
  }

  /**
   * Spustí fn v transakci s rolí a JWT claims stejně, jako to dělá PostgREST
   * pro požadavek s publishable klíčem (anon) nebo s uživatelským JWT (authenticated).
   * Při výjimce se transakce celá vrátí.
   */
  async as<T>(userId: string | null, fn: (q: Query) => Promise<T>): Promise<T> {
    return this.pg.transaction(async (tx) => {
      const role = userId ? "authenticated" : "anon";
      await tx.exec(`set local role ${role}`);
      const claims = userId ? { sub: userId, role } : { role };
      await tx.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify(claims)]);
      const q: Query = async (sql, params) => (await tx.query(sql, params)).rows as never;
      return fn(q);
    });
  }

  /** Jeden SQL příkaz jako daný uživatel. */
  q<T extends Row = Row>(userId: string | null, sql: string, params?: unknown[]): Promise<T[]> {
    return this.as(userId, (q) => q<T>(sql, params));
  }

  async rpc<T = unknown>(userId: string | null, call: string, params: unknown[] = []): Promise<T> {
    const [row] = await this.q<{ result: T }>(userId, `select ${call} as result`, params);
    return row.result;
  }
}

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith(".sql")).sort();
}

export async function createDb(opts: { upTo?: string } = {}): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUB);
  for (const file of migrationFiles()) {
    if (opts.upTo && file > opts.upTo) break;
    await pg.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  }
  return new TestDb(pg);
}

/** Očekává databázovou chybu s daným SQLSTATE (např. PT403, 42501 = insufficient_privilege). */
export async function expectDbError(promise: Promise<unknown>, codes: string | string[]) {
  const expected = Array.isArray(codes) ? codes : [codes];
  let error: unknown;
  try {
    await promise;
  } catch (e) {
    error = e;
  }
  expect(error, `očekávána chyba ${expected.join("/")}`).toBeDefined();
  expect(expected).toContain((error as { code?: string }).code);
}
