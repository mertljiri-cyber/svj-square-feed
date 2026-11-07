import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { typeLabels, statusLabels, priorityLabels, transitions, handlerOnlyTargets, eventLabels, fmt } from "@/features/requests/labels";

type Member = { user_id: string; email: string; display_name: string | null; status: string };
const selectClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

function RequestDetailInner() {
  const { id } = useParams<{ id: string }>();
  const { session, activeMembership, isBoard } = useAuth();
  const userId = session!.user.id;
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");
  const [internal, setInternal] = useState(false);
  const [reopenReason, setReopenReason] = useState("");
  const [t, setT] = useState({ to: "", note: "", assignee: "", due: "", resolution: "", duplicateNumber: "", priority: "" });

  const { data: request, isLoading } = useQuery({
    queryKey: ["request", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["request-events", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("request_events").select("*").eq("request_id", id!).order("occurred_at");
      if (error) throw error;
      return data;
    },
    enabled: !!request,
  });
  const { data: members = [] } = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members", { p_organization_id: orgId });
      if (error) throw error;
      return (data as unknown as Member[]).filter((m) => m.status === "active");
    },
    enabled: isBoard,
  });

  async function refresh() {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["request", id] }),
      qc.invalidateQueries({ queryKey: ["request-events", id] }),
      qc.invalidateQueries({ queryKey: ["my-requests"] }),
      qc.invalidateQueries({ queryKey: ["request-queue"] }),
    ]);
  }
  // Chybu vždy ukážeme tak, jak ji vrátil server; při konfliktu se data znovu načtou.
  async function run(done: string, p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    setMessage(error ? error.message : done);
    await refresh();
    return !error;
  }

  if (isLoading) return <Layout><div className="page-container py-12 text-muted-foreground">Načítání…</div></Layout>;
  if (!request) {
    return <Layout><div className="page-container py-12"><h1 className="text-2xl font-bold">Požadavek nenalezen</h1><Link className="mt-4 inline-block text-primary underline" to="/pozadavky">Zpět na požadavky</Link></div></Layout>;
  }

  const isAuthor = request.author_user_id === userId;
  const isAssignee = request.assignee_user_id === userId;
  const handler = isBoard || isAssignee;
  const targets = (transitions[request.workflow_status] ?? []).filter((x) => isBoard || handlerOnlyTargets.includes(x));
  const canReopen = isAuthor && ["resolved", "closed"].includes(request.workflow_status);
  const assigneeName = members.find((m) => m.user_id === request.assignee_user_id);

  async function changeStatus(e: React.FormEvent) {
    e.preventDefault();
    let duplicateOf: string | null = null;
    if (t.to === "duplicate") {
      const { data } = await supabase.from("requests").select("id").eq("organization_id", request!.organization_id).eq("number", Number(t.duplicateNumber)).maybeSingle();
      if (!data) { setMessage("Požadavek s tímto číslem nebyl nalezen."); return; }
      duplicateOf = data.id;
    }
    const ok = await run("Stav změněn.", supabase.rpc("change_request_status", {
      p_request_id: request!.id, p_to: t.to, p_expected_row_version: request!.row_version,
      p_note: t.note || null, p_assignee: t.assignee || null, p_due_on: t.due || null,
      p_resolution: t.resolution || null, p_duplicate_of: duplicateOf, p_priority: t.priority || null,
    }));
    if (ok) setT({ to: "", note: "", assignee: "", due: "", resolution: "", duplicateNumber: "", priority: "" });
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <Link to={isBoard && !isAuthor ? "/pozadavky/fronta" : "/pozadavky"} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Zpět</Link>
        <p className="text-sm text-muted-foreground">Požadavek č. {request.number} · {typeLabels[request.type] ?? request.type}</p>
        <h1 className="mt-1 text-3xl font-bold">{request.title}</h1>
        <p className="mt-3"><span className="rounded-full bg-secondary px-3 py-1 text-sm">{statusLabels[request.workflow_status] ?? request.workflow_status}</span></p>
        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}

        <div className="mt-8 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border bg-card p-6">
              <p className="whitespace-pre-wrap text-sm">{request.description}</p>
              <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Místo</dt><dd>{request.location || "Nedoplněno"}</dd></div>
                <div><dt className="text-muted-foreground">Technický prvek</dt><dd>{request.asset_ref || "Bez vazby"}</dd></div>
                <div><dt className="text-muted-foreground">Řešitel</dt><dd>{request.assignee_user_id ? (assigneeName?.display_name || assigneeName?.email || (isAssignee ? "Vy" : "Přidělen")) : "Nepřidělen"}</dd></div>
                <div><dt className="text-muted-foreground">Termín</dt><dd>{request.due_on ? new Date(request.due_on).toLocaleDateString("cs-CZ") : "Neurčen"}</dd></div>
                {isBoard && <div><dt className="text-muted-foreground">Priorita (interní)</dt><dd>{request.triage_priority ? priorityLabels[request.triage_priority] : "Neurčena"}</dd></div>}
              </dl>
              {request.resolution_text && <div className="mt-5 rounded-lg border border-primary/30 p-4 text-sm"><p className="font-medium">Výsledek řešení</p><p className="mt-1 whitespace-pre-wrap">{request.resolution_text}</p></div>}
            </section>

            <section className="rounded-xl border bg-card p-6">
              <h2 className="mb-4 text-lg font-semibold">Historie</h2>
              <ol className="space-y-4">
                {events.map((ev) => (
                  <li key={ev.id} className="border-l-2 border-primary/30 pl-4 text-sm">
                    <p className="text-xs text-muted-foreground">{fmt(ev.occurred_at)} · {eventLabels[ev.event_type] ?? ev.event_type}{ev.internal ? " · interní" : ""}</p>
                    {ev.to_status && <p className="mt-1">{ev.from_status ? `${statusLabels[ev.from_status] ?? ev.from_status} → ` : ""}{statusLabels[ev.to_status] ?? ev.to_status}</p>}
                    {ev.note && <p className="mt-1 whitespace-pre-wrap">{ev.note}</p>}
                  </li>
                ))}
              </ol>
              {(isAuthor || handler) && (
                <form className="mt-6" onSubmit={async (e) => { e.preventDefault(); if (await run("Komentář uložen.", supabase.rpc("add_request_comment", { p_request_id: request.id, p_body: comment, p_internal: internal }))) { setComment(""); setInternal(false); } }}>
                  <label className="block text-sm font-medium">Doplnit komentář<Textarea className="mt-1" required maxLength={5000} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
                  {handler && <label className="mt-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />Interní poznámka (autor ji neuvidí)</label>}
                  <Button className="mt-3" type="submit" variant="outline" disabled={!comment.trim()}>Uložit komentář</Button>
                </form>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            {canReopen && (
              <section className="rounded-xl border bg-card p-6">
                <h2 className="mb-2 font-semibold">Požádat o znovuotevření</h2>
                <p className="mb-3 text-sm text-muted-foreground">Požadavek se vrátí k posouzení výboru.</p>
                <form onSubmit={async (e) => { e.preventDefault(); if (await run("Žádost odeslána.", supabase.rpc("request_reopen", { p_request_id: request.id, p_reason: reopenReason, p_expected_row_version: request.row_version }))) setReopenReason(""); }}>
                  <Textarea required minLength={3} maxLength={2000} value={reopenReason} onChange={(e) => setReopenReason(e.target.value)} placeholder="Důvod" />
                  <Button className="mt-3" type="submit" variant="outline">Odeslat žádost</Button>
                </form>
              </section>
            )}
            {handler && targets.length > 0 && (
              <section className="rounded-xl border bg-card p-6">
                <h2 className="mb-3 font-semibold">Vyřízení</h2>
                <form onSubmit={changeStatus} className="space-y-3">
                  <label className="block text-sm font-medium">Nový stav
                    <select required className={selectClass} value={t.to} onChange={(e) => setT({ ...t, to: e.target.value })}>
                      <option value="">Vyberte</option>
                      {targets.map((x) => <option key={x} value={x}>{statusLabels[x]}</option>)}
                    </select>
                  </label>
                  {isBoard && (
                    <label className="block text-sm font-medium">Řešitel
                      <select className={selectClass} value={t.assignee} onChange={(e) => setT({ ...t, assignee: e.target.value })}>
                        <option value="">Beze změny</option>
                        {members.map((m) => <option key={m.user_id} value={m.user_id}>{m.display_name || m.email}</option>)}
                      </select>
                    </label>
                  )}
                  {isBoard && (
                    <label className="block text-sm font-medium">Priorita
                      <select className={selectClass} value={t.priority} onChange={(e) => setT({ ...t, priority: e.target.value })}>
                        <option value="">Beze změny</option>
                        {Object.entries(priorityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                  )}
                  <label className="block text-sm font-medium">Termín<Input className="mt-1" type="date" value={t.due} onChange={(e) => setT({ ...t, due: e.target.value })} /></label>
                  {t.to === "duplicate" && <label className="block text-sm font-medium">Číslo hlavního požadavku<Input className="mt-1" type="number" min={1} required value={t.duplicateNumber} onChange={(e) => setT({ ...t, duplicateNumber: e.target.value })} /></label>}
                  {t.to === "resolved" && <label className="block text-sm font-medium">Výsledek řešení *<Textarea className="mt-1" required value={t.resolution} onChange={(e) => setT({ ...t, resolution: e.target.value })} /></label>}
                  <label className="block text-sm font-medium">Poznámka (u zamítnutí, duplicity a zařazení bez řešitele povinná)<Textarea className="mt-1" value={t.note} onChange={(e) => setT({ ...t, note: e.target.value })} /></label>
                  <Button type="submit" disabled={!t.to}>Uložit změnu</Button>
                </form>
              </section>
            )}
          </aside>
        </div>
      </div>
    </Layout>
  );
}

export default function RequestDetail() {
  return <RequireMember><RequestDetailInner /></RequireMember>;
}
