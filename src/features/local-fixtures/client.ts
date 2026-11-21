// Synthetic in-memory adapter ONLY aliased by Vite's local-fixtures mode.
// No fetch, credentials, filesystem or backend. This is not an authorization boundary.
import { answerQuestion, type Source } from '../../../supabase/functions/ask-house/core';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
export const fixture = {
  role: 'owner', scenario: 'answer', active: true, calls: 0,
  requests: [] as Record<string, unknown>[], events: [] as Record<string, unknown>[],
  audit: [{id: 1, organization_id: 'synthetic-org', action: 'publish_house_markdown', object_type: 'house_markdown', object_id: 'opravy', occurred_at: '2026-11-21T00:00:00.000Z', details: {revision: 'a'.repeat(64)}}] as Record<string, unknown>[],
};
export const user = () => fixture.role === 'board' ? 'synthetic-board' : fixture.role === 'other' ? 'synthetic-other' : 'synthetic-owner';
const source: Source = {id: 'opravy:' + 'a'.repeat(64) + ':3', note_key: 'opravy', revision: 'a'.repeat(64), title: 'Syntetické opravy', section: 'Zvonky', body: 'V modelovém domě byla schválena výměna zvonků. Termín realizace zatím není stanoven.'};
const readable = (row: Record<string, unknown>) => row.organization_id === 'synthetic-org' && (fixture.role === 'board' || row.author_user_id === user());
function rows(table: string): Record<string, unknown>[] {
  if (table === 'requests') return fixture.requests.filter(readable);
  if (table === 'request_events') return fixture.events.filter(e => fixture.requests.some(r => r.id === e.request_id && readable(r)));
  if (table === 'audit_events') return fixture.role === 'board' ? fixture.audit : [];
  return [];
}
class Query {
  filters: ((row: Record<string, unknown>) => boolean)[] = [];
  sorting: {key: string; asc: boolean} | null = null;
  cap = 1000;
  single = false;
  constructor(readonly table: string) {}
  select() { return this; }
  eq(key: string, value: unknown) {this.filters.push(r => r[key] === value); return this;}
  lt(key: string, value: number) {this.filters.push(r => Number(r[key]) < value); return this;}
  order(key: string, options?: {ascending?: boolean}) {this.sorting = {key, asc: options?.ascending !== false}; return this;}
  limit(count: number) {this.cap = count; return this;}
  maybeSingle() {this.single = true; return this;}
  then(resolve: (result: {data: unknown; error: null}) => unknown) {
    let data = rows(this.table).filter(r => this.filters.every(f => f(r)));
    const sorting = this.sorting;
    if (sorting) data = [...data].sort((a, b) => {
      const x = a[sorting.key], y = b[sorting.key];
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return order * (sorting.asc ? 1 : -1);
    });
    data = data.slice(0, this.cap);
    return Promise.resolve(resolve({data: this.single ? data[0] ?? null : data, error: null}));
  }
}
async function rpc(name: string, p: Record<string, unknown> = {}) {
  if (name === 'read_house_markdown') return {data: fixture.active && p.p_org === 'synthetic-org' && Array.isArray(p.p_ids) && p.p_ids.includes(source.id) ? [{...source}] : [], error: null};
  if (name === 'create_request') {
    fixture.calls++;
    const existing = fixture.requests.find(r => r.idempotency_key === p.p_idempotency_key && r.author_user_id === user());
    if (existing) return {data: {id: existing.id, number: existing.number}, error: null};
    const now = new Date().toISOString();
    const row = {id: crypto.randomUUID(), number: fixture.requests.length + 1, organization_id: 'synthetic-org', author_user_id: user(), title: p.p_title, description: p.p_description, type: p.p_type, location: p.p_location, asset_ref: p.p_asset_ref, idempotency_key: p.p_idempotency_key, workflow_status: 'new', row_version: 1, created_at: now, updated_at: now, assignee_user_id: null, due_on: null, resolution_text: null, triage_priority: null};
    fixture.requests.push(row);
    fixture.events.push({id: crypto.randomUUID(), organization_id: 'synthetic-org', request_id: row.id, occurred_at: now, event_type: 'created', to_status: 'new', internal: false});
    return {data: {id: row.id, number: row.number}, error: null};
  }
  if (name === 'withdraw_house_markdown' && fixture.role === 'board') {
    fixture.active = false;
    fixture.audit.push({id: fixture.audit.length + 1, organization_id: 'synthetic-org', action: name, object_type: 'house_markdown', object_id: 'opravy', occurred_at: new Date().toISOString(), details: {}});
    return {data: null, error: null};
  }
  if (['list_members', 'list_request_evidence'].includes(name)) return {data: [], error: null};
  return {data: null, error: {message: 'Tato akce není součástí lokální syntetické fixture.'}};
}
const adapter = {
  from: (table: string) => new Query(table), rpc,
  functions: {invoke: async (_name: string, options: {body: {question: string}}) => {
    await new Promise(resolve => setTimeout(resolve, 650));
    if (['error', 'limit'].includes(fixture.scenario)) return {data: null, error: {context: {status: fixture.scenario === 'limit' ? 429 : 503}}};
    return {data: await answerQuestion(options.body.question, {search: async () => fixture.active && fixture.scenario !== 'unknown' ? [source] : [], recheck: async () => fixture.active ? [source] : [], generate: async () => ({kind: 'answer', claims: [{text: source.body, citations: [1]}]})}), error: null};
  }},
};
export const supabase = adapter as unknown as SupabaseClient<Database>;
