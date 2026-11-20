import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { Route, Routes } from "react-router-dom";
import { buildWorld, type World } from "./helpers/fixtures";
import { expectDbError } from "./helpers/db";
import { emptyRequestDraft, requestDraftForAsset } from "../../src/features/requests/assetDraft";
import Requests from "../../src/pages/Requests";
import RequestDetail from "../../src/pages/RequestDetail";
import TechnicalAssetDetail from "../../src/pages/TechnicalAssetDetail";

const ui = vi.hoisted(() => ({
  user: "synthetic-owner", org: "synthetic-org", board: false,
  row: {
    id: "synthetic-request", organization_id: "synthetic-org", author_user_id: "synthetic-owner", number: 42,
    title: "Syntetická závada", description: "Pouze syntetický popis", type: "defect", asset_ref: "SYN-001",
    workflow_status: "in_progress", created_at: "2026-01-01T08:00:00.000Z", updated_at: "2026-01-02T09:30:00.000Z",
    assignee_user_id: null, location: "Testovací místnost", due_on: null, resolution_text: null, row_version: 2,
  },
  queries: [] as Array<{ queryKey: string[]; queryFn: () => Promise<unknown> }>,
  rpc: vi.fn(),
  from: vi.fn(),
}));
vi.mock("@/data/technical-register.json", () => ({ default: [{ id: "SYN-001", name: "Syntetický prvek", location: "Testovací místnost", area: "Test", state: "Nezjištěno", criticality: "Nízká" }] }));
vi.mock("@/components/layout/Layout", () => ({ Layout: ({ children }: { children: React.ReactNode }) => children }));
vi.mock("@/features/auth/AuthProvider", () => ({ useAuth: () => ({ session: { user: { id: ui.user } }, activeMembership: { organization_id: ui.org }, isBoard: ui.board, loading: false }) }));
vi.mock("@/features/requests/RequestEvidence", () => ({ RequestEvidence: () => null }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc: ui.rpc, from: ui.from } }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useQuery: (options: { queryKey: string[]; queryFn: () => Promise<unknown> }) => {
    ui.queries.push(options);
    return { data: options.queryKey[0] === "my-requests" ? [ui.row] : options.queryKey[0] === "request" ? ui.row : [], isLoading: false, error: null };
  },
}));
const syntheticAssets = [{ id: "SYN-001", name: "Syntetický prvek", location: "Testovací místnost" }];
const render = (path: string, route: string, component: React.ReactElement) => renderToStaticMarkup(
  React.createElement(StaticRouter, { location: path }, React.createElement(Routes, null, React.createElement(Route, { path: route, element: component }))),
);

beforeEach(() => { ui.queries.length = 0; ui.rpc.mockClear(); ui.user = "synthetic-owner"; ui.org = "synthetic-org"; });

describe("8 — předvyplnění existujícího formuláře bez odeslání", () => {
  it("přebírá jen známý přesný identifikátor a nechává popis k doplnění", () => {
    expect(requestDraftForAsset("SYN-001", syntheticAssets)).toEqual({ ...emptyRequestDraft(), title: "Závada: Syntetický prvek", location: "Testovací místnost", asset_ref: "SYN-001" });
    for (const value of [null, "", "syn-001", " SYN-001", "SYN-999", "SYN-001<script>"]) expect(requestDraftForAsset(value, syntheticAssets)).toBeNull();
  });
  it("detail prvku odkazuje na formulář; formulář předvyplní prvek a místo, nevolá RPC", () => {
    const detail = render("/technicky-prehled/SYN-001", "/technicky-prehled/:id", React.createElement(TechnicalAssetDetail));
    expect(detail).toContain('href="/pozadavky?prvek=SYN-001"');
    const form = render("/pozadavky?prvek=SYN-001", "/pozadavky", React.createElement(Requests));
    expect(form).toContain("<form");
    expect(form).toContain('value="Závada: Syntetický prvek"');
    expect(form).toContain('value="Testovací místnost"');
    expect(form).toContain('value="SYN-001"');
    expect(form).toContain('href="/technicky-prehled/SYN-001"');
    expect(form).toContain("zatím nebylo nic odesláno");
    expect(ui.rpc).not.toHaveBeenCalled();
  });
  it("neznámý prvek neotevře automaticky formulář", () => {
    expect(render("/pozadavky?prvek=SYN-999", "/pozadavky", React.createElement(Requests))).not.toContain("<form");
    expect(ui.rpc).not.toHaveBeenCalled();
  });
});

describe("9 — dohledatelný vlastní požadavek a čas poslední změny", () => {
  it("dotaz seznamu výslovně filtruje autora i SVJ a řadí poslední změny", async () => {
    const query = { select: vi.fn(), eq: vi.fn(), order: vi.fn().mockResolvedValue({ data: [ui.row], error: null }) };
    query.select.mockReturnValue(query);
    query.eq.mockReturnValue(query);
    ui.from.mockReturnValue(query);
    render("/pozadavky", "/pozadavky", React.createElement(Requests));
    expect(await ui.queries.find(q => q.queryKey[0] === "my-requests")!.queryFn()).toEqual([ui.row]);
    expect(ui.from).toHaveBeenCalledWith("requests");
    expect(query.eq.mock.calls).toEqual([["author_user_id", ui.user], ["organization_id", ui.org]]);
    expect(query.order).toHaveBeenCalledWith("updated_at", { ascending: false });
  });
  it("seznam obsahuje odkaz, skutečný stav a updated_at", () => {
    const html = render("/pozadavky", "/pozadavky", React.createElement(Requests));
    expect(html).toContain('href="/pozadavky/synthetic-request"');
    expect(html).toContain("V řešení");
    expect(html).toContain(`dateTime="${ui.row.updated_at}"`);
    expect(html).toContain("Poslední změna");
    expect(ui.queries[0].queryKey).toEqual(["my-requests", ui.user, ui.org]);
  });
  it("detail zobrazuje stav, oba časy a izoluje cache podle uživatele i SVJ", () => {
    const html = render("/pozadavky/synthetic-request", "/pozadavky/:id", React.createElement(RequestDetail));
    expect(html).toContain("V řešení");
    expect(html).toContain(`dateTime="${ui.row.updated_at}"`);
    expect(html).toContain(`dateTime="${ui.row.created_at}"`);
    expect(ui.queries.find(q => q.queryKey[0] === "request")?.queryKey).toEqual(["request", "synthetic-request", ui.user, ui.org]);
    expect(ui.queries.find(q => q.queryKey[0] === "request-events")?.queryKey).toEqual(["request-events", "synthetic-request", ui.user, ui.org]);
    ui.user = "synthetic-other-owner";
    render("/pozadavky/synthetic-request", "/pozadavky/:id", React.createElement(RequestDetail));
    expect(ui.queries.filter(q => q.queryKey[0] === "request").at(-1)?.queryKey).not.toEqual(["request", "synthetic-request", "synthetic-owner", ui.org]);
  });
});

describe("9 — skutečné lokální RPC a RLS se syntetickými rolemi", () => {
  let w: World;
  beforeAll(async () => { w = await buildWorld(); });
  afterAll(async () => { await w?.db.pg.close(); });

  it("podaný požadavek najde autor, ne jiný vlastník nebo jiné SVJ; změna stavu aktualizuje čas", async () => {
    const created = await w.db.rpc<{ id: string; number: number }>(w.ownerA,
      "public.create_request($1, 'defect', 'Syntetická závada prvku', 'Syntetický popis pro test', 'Testovací místnost', 'SYN-001', 'overnight-synthetic-001')", [w.orgA]);
    type RequestRow = { id: string; number: number; workflow_status: string; asset_ref: string; updated_at: Date; row_version: number };
    const list = () => w.db.q<RequestRow>(w.ownerA, "select id, number, workflow_status, asset_ref, updated_at, row_version from public.requests where author_user_id=$1 and organization_id=$2 order by updated_at desc", [w.ownerA, w.orgA]);
    const [initial] = await list();
    expect(initial).toMatchObject({ id: created.id, number: created.number, workflow_status: "new", asset_ref: "SYN-001" });
    for (const user of [w.ownerA2, w.ownerB, w.boardB, w.technicalA, w.outsider, w.suspendedA]) {
      expect(await w.db.q(user, "select id from public.requests where id=$1", [created.id])).toEqual([]);
      expect(await w.db.q(user, "select id from public.request_events where request_id=$1", [created.id])).toEqual([]);
    }
    await expectDbError(w.db.q(null, "select id from public.requests where id=$1", [created.id]), "42501");
    await expectDbError(w.db.rpc(w.ownerA2, "public.add_request_comment($1, 'Cizí komentář', false)", [created.id]), "PT404");
    await w.db.rpc(w.boardA, "public.change_request_status($1, 'triaged', $2, null, $3)", [created.id, initial.row_version, w.technicalA]);
    const [updated] = await list();
    expect(updated.workflow_status).toBe("triaged");
    expect(new Date(updated.updated_at).getTime()).toBeGreaterThan(new Date(initial.updated_at).getTime());
    expect(await w.db.q(w.technicalA, "select id from public.requests where id=$1", [created.id])).toHaveLength(1);
    expect(await w.db.q(w.ownerA2, "select id from public.requests where id=$1", [created.id])).toEqual([]);
    expect(await w.db.q(w.ownerA, "select to_status from public.request_events where request_id=$1 order by occurred_at", [created.id])).toMatchObject([{ to_status: "new" }, { to_status: "triaged" }]);
    const retry = await w.db.rpc<{ id: string; duplicate: boolean }>(w.ownerA,
      "public.create_request($1, 'defect', 'Syntetická závada prvku', 'Syntetický popis pro test', 'Testovací místnost', 'SYN-001', 'overnight-synthetic-001')", [w.orgA]);
    expect(retry).toMatchObject({ id: created.id, duplicate: true });
    expect(await list()).toHaveLength(1);
  });
});
