import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calendar, User, MapPin } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDateTime, getStatusLabel, getPriorityLabel } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";

// Zrcadlí pravidla serveru jen pro nabídku v UI; rozhoduje vždy databáze.
const nextStatuses: Record<string, string[]> = {
  navrh: ["projednava-se"],
  "projednava-se": ["navrh", "schvaleno"],
  schvaleno: ["projednava-se", "realizace"],
  realizace: ["schvaleno", "hotovo"],
  hotovo: ["realizace"],
};
const eventLabels: Record<string, string> = { created: "Záměr podán", edited: "Upraveno", status_changed: "Změna stavu", comment: "Komentář" };
const fieldLabels: Record<string, string> = { title: "název", description: "popis", location: "místo", priority: "priorita", estimated_cost: "odhad nákladů", planned_year: "rok" };
const money = (v: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 2 }).format(v);
const selectClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

export default function IntentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { session, activeMembership, isBoard } = useAuth();
  const userId = session?.user.id;
  const [message, setMessage] = useState("");
  const [edit, setEdit] = useState<{ title: string; description: string; priority: string; location: string; cost: string; year: string } | null>(null);
  const [toStatus, setToStatus] = useState("");
  const [decision, setDecision] = useState("");
  const [comment, setComment] = useState("");

  const { data: intent, isLoading, error } = useQuery({
    queryKey: ["intent", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("intents").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });
  const { data: events = [] } = useQuery({
    queryKey: ["intent-events", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("intent_events").select("*").eq("intent_id", id!).order("occurred_at");
      if (error) throw error;
      return data;
    },
    enabled: !!intent,
  });
  const { data: people = [] } = useQuery({
    queryKey: ["intent-people", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("intent_people", { p_intent_id: id! });
      if (error) throw error;
      return data;
    },
    enabled: !!intent,
  });

  const refresh = () => Promise.all(["intent", "intent-events", "intent-people", "intents"].map((k) => qc.invalidateQueries({ queryKey: [k] })));
  async function run(done: string, p: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await p;
    setMessage(error ? error.message : done);
    await refresh();
    return !error;
  }

  if (isLoading) {
    return <Layout><div className="page-container"><Skeleton className="h-8 w-32 mb-6" /><Skeleton className="h-12 w-3/4 mb-4" /><Skeleton className="h-48 w-full" /></div></Layout>;
  }
  if (error || !intent) {
    return (
      <Layout>
        <div className="page-container text-center py-16">
          <h1 className="text-2xl font-bold text-foreground mb-4">Záměr nenalezen</h1>
          <p className="text-muted-foreground mb-6">Požadovaný záměr neexistuje nebo k němu nemáte přístup.</p>
          <Link to="/zamery"><Button><ArrowLeft className="h-4 w-4 mr-2" />Zpět na záměry</Button></Link>
        </div>
      </Layout>
    );
  }

  const grants = activeMembership?.grants ?? [];
  const canManage = isBoard || grants.some((g) => g.scope === "intents" && g.permission === "write");
  const isAuthor = !!userId && intent.created_by === userId;
  const status = intent.status ?? "navrh";
  const canEdit = canManage || (isAuthor && status === "navrh");
  const statusClass = `status-${status}`;
  const priorityClass = intent.priority ? `priority-${intent.priority}` : "priority-medium";
  const names = new Map(people.map((p) => [p.user_id, p.display_name]));
  const targets = nextStatuses[status] ?? [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const ok = await run("Záměr uložen.", supabase.rpc("update_intent", {
      p_intent_id: intent!.id, p_title: edit.title, p_description: edit.description || null, p_priority: edit.priority,
      p_location: edit.location || null, p_estimated_cost: edit.cost === "" ? null : Number(edit.cost.replace(",", ".")),
      p_planned_year: edit.year === "" ? null : Number(edit.year), p_expected_row_version: intent!.row_version,
    }));
    if (ok) setEdit(null);
  }

  async function remove() {
    if (!window.confirm("Opravdu smazat tento záměr včetně historie? Akci nelze vrátit.")) return;
    const { error } = await supabase.from("intents").delete().eq("id", intent!.id);
    if (error) { setMessage("Záměr se nepodařilo smazat."); return; }
    await qc.invalidateQueries({ queryKey: ["intents"] });
    navigate("/zamery");
  }

  return (
    <Layout>
      <article className="page-container max-w-4xl">
        <Link to="/zamery" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />Zpět na záměry
        </Link>

        <header className="mb-8">
          <div className="flex flex-wrap items-start gap-4 mb-4">
            <h1 className="text-3xl md:text-4xl font-bold text-foreground text-balance flex-1">{intent.title}</h1>
            <span className={`status-badge ${statusClass} text-base px-4 py-1.5`}>{getStatusLabel(status)}</span>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
            {intent.proposer_name && <span className="flex items-center gap-1.5"><User className="h-4 w-4" />Navrhovatel: {intent.proposer_name}</span>}
            {intent.created_at && <span className="flex items-center gap-1.5"><Calendar className="h-4 w-4" />{formatDateTime(intent.created_at)}</span>}
            {intent.location && <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" />{intent.location}</span>}
            {intent.priority && <span className={`status-badge ${priorityClass}`}>Priorita: {getPriorityLabel(intent.priority)}</span>}
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-muted-foreground">Odhad nákladů</dt><dd>{intent.estimated_cost !== null ? money(Number(intent.estimated_cost)) : "Neodhadnuto"}</dd></div>
            <div><dt className="text-muted-foreground">Plánovaný rok</dt><dd>{intent.planned_year ?? "Neurčen"}</dd></div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Záměr je návrh. Schválený odhad nákladů ani termín nevyplývají z tohoto záznamu.</p>
        </header>

        {message && <p role="status" className="mb-6 rounded-lg border p-3 text-sm">{message}</p>}

        {intent.decision_note && (
          <div className="mb-6 rounded-xl border border-primary/30 bg-card p-5 text-sm">
            <p className="font-medium">Odkaz na rozhodnutí</p>
            <p className="mt-1 whitespace-pre-wrap">{intent.decision_note}</p>
          </div>
        )}

        {edit ? (
          <form onSubmit={save} className="mb-8 space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-lg font-semibold">Upravit záměr</h2>
            <label className="block text-sm font-medium">Název *<Input className="mt-1" required minLength={3} maxLength={200} value={edit.title} onChange={(e) => setEdit({ ...edit, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Popis<Textarea className="mt-1 min-h-32" maxLength={5000} value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></label>
            <label className="block text-sm font-medium">Místo<Input className="mt-1" maxLength={120} value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></label>
            {canManage && (
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="text-sm font-medium">Priorita
                  <select className={selectClass} value={edit.priority} onChange={(e) => setEdit({ ...edit, priority: e.target.value })}>
                    <option value="low">Nízká</option><option value="medium">Střední</option><option value="high">Vysoká</option>
                  </select>
                </label>
                <label className="text-sm font-medium">Odhad nákladů (Kč)<Input className="mt-1" inputMode="decimal" placeholder="Neodhadnuto" value={edit.cost} onChange={(e) => setEdit({ ...edit, cost: e.target.value })} /></label>
                <label className="text-sm font-medium">Plánovaný rok<Input className="mt-1" type="number" min={1900} max={2100} placeholder="Neurčen" value={edit.year} onChange={(e) => setEdit({ ...edit, year: e.target.value })} /></label>
              </div>
            )}
            <div className="flex gap-3"><Button type="submit">Uložit</Button><Button type="button" variant="outline" onClick={() => setEdit(null)}>Zrušit</Button></div>
          </form>
        ) : (
          <>
            {intent.description && (
              <div className="bg-card border border-border rounded-xl p-6 mb-6">
                <h2 className="text-lg font-semibold text-foreground mb-4">Popis záměru</h2>
                <div className="prose prose-slate max-w-none">
                  {intent.description.split("\n").map((paragraph, index) => (
                    <p key={index} className="text-foreground leading-relaxed mb-4 last:mb-0">{paragraph}</p>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-8 flex flex-wrap gap-3">
              {canEdit && (
                <Button variant="outline" onClick={() => { setEdit({ title: intent.title, description: intent.description ?? "", priority: intent.priority ?? "medium", location: intent.location ?? "", cost: intent.estimated_cost === null ? "" : String(intent.estimated_cost), year: intent.planned_year === null ? "" : String(intent.planned_year) }); setMessage(""); }}>Upravit záměr</Button>
              )}
              {isBoard && <Button variant="ghost" className="text-destructive" onClick={remove}>Smazat záměr</Button>}
            </div>
          </>
        )}

        {canManage && targets.length > 0 && (
          <section className="mb-8 rounded-xl border bg-card p-6">
            <h2 className="mb-3 text-lg font-semibold">Změna stavu</h2>
            <form className="space-y-3" onSubmit={async (e) => { e.preventDefault(); if (await run("Stav změněn.", supabase.rpc("change_intent_status", { p_intent_id: intent.id, p_status: toStatus, p_expected_row_version: intent.row_version, p_decision_note: decision || null }))) { setToStatus(""); setDecision(""); } }}>
              <label className="block text-sm font-medium">Nový stav
                <select required className={selectClass} value={toStatus} onChange={(e) => setToStatus(e.target.value)}>
                  <option value="">Vyberte</option>
                  {targets.map((t) => <option key={t} value={t}>{getStatusLabel(t)}</option>)}
                </select>
              </label>
              {toStatus === "schvaleno" && (
                <label className="block text-sm font-medium">Odkaz na rozhodnutí *<Textarea className="mt-1" required maxLength={2000} placeholder="Např. usnesení shromáždění č. 3/2026, bod 4" value={decision} onChange={(e) => setDecision(e.target.value)} /></label>
              )}
              <Button type="submit" disabled={!toStatus}>Změnit stav</Button>
              <p className="text-xs text-muted-foreground">Schválit smí jen výbor nebo osoba s oprávněním ke schvalování.</p>
            </form>
          </section>
        )}

        <section className="rounded-xl border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold">Historie a diskuse</h2>
          <ol className="space-y-4">
            {events.map((ev) => {
              const fields = (ev.details as { fields?: string[] } | null)?.fields;
              return (
                <li key={ev.id} className="border-l-2 border-primary/30 pl-4 text-sm">
                  <p className="text-xs text-muted-foreground">{formatDateTime(ev.occurred_at)} · {(ev.actor_user_id && names.get(ev.actor_user_id)) || "Člen SVJ"} · {eventLabels[ev.event_type] ?? ev.event_type}</p>
                  {ev.to_status && <p className="mt-1">{ev.from_status ? `${getStatusLabel(ev.from_status)} → ` : ""}{getStatusLabel(ev.to_status)}</p>}
                  {fields && fields.length > 0 && <p className="mt-1">Změněno: {fields.map((f) => fieldLabels[f] ?? f).join(", ")}</p>}
                  {ev.note && <p className="mt-1 whitespace-pre-wrap">{ev.note}</p>}
                </li>
              );
            })}
          </ol>
          <form className="mt-6" onSubmit={async (e) => { e.preventDefault(); if (await run("Komentář uložen.", supabase.rpc("add_intent_comment", { p_intent_id: intent.id, p_body: comment }))) setComment(""); }}>
            <label className="block text-sm font-medium">Přidat komentář<Textarea className="mt-1" required maxLength={5000} value={comment} onChange={(e) => setComment(e.target.value)} /></label>
            <Button className="mt-3" type="submit" variant="outline" disabled={!comment.trim()}>Uložit komentář</Button>
          </form>
        </section>
      </article>
    </Layout>
  );
}
