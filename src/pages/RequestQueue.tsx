import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { RequireMember } from "@/features/auth/RequireMember";
import { supabase } from "@/integrations/supabase/client";
import { typeLabels, statusLabels, priorityLabels, fmt } from "@/features/requests/labels";

function QueueInner() {
  const [filter, setFilter] = useState("open");
  const { data = [], isLoading, error } = useQuery({
    queryKey: ["request-queue"],
    queryFn: async () => {
      const { data: rows, error } = await supabase.from("requests").select("*").order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      const ids = rows.map((r) => r.id);
      const { data: people } = ids.length ? await supabase.rpc("request_people", { p_request_ids: ids }) : { data: [] };
      const names = new Map((people ?? []).map((p) => [p.user_id, p.display_name]));
      return rows.map((r) => ({ ...r, author: names.get(r.author_user_id) ?? null, assignee: r.assignee_user_id ? names.get(r.assignee_user_id) ?? "Přidělen" : null }));
    },
  });
  const closedStates = ["closed", "rejected", "duplicate"];
  const rows = data.filter((r) => filter === "all" || (filter === "open" ? !closedStates.includes(r.workflow_status) : r.workflow_status === filter));

  return (
    <Layout>
      <div className="page-container py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Výbor</p>
            <h1 className="text-3xl font-bold md:text-4xl">Fronta požadavků</h1>
            <p className="mt-3 text-muted-foreground">Všechny požadavky SVJ. Zobrazují se pouze výboru a přiděleným řešitelům.</p>
          </div>
          <label className="text-sm">Zobrazit
            <select className="ml-2 h-10 rounded-md border bg-background px-3" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="open">Otevřené</option><option value="all">Všechny</option>
              {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>
        {isLoading && <p className="mt-8 text-muted-foreground">Načítání…</p>}
        {error && <p role="alert" className="mt-8 text-destructive">Frontu se nepodařilo načíst.</p>}
        {!isLoading && !error && rows.length === 0 && <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">Žádné požadavky neodpovídají filtru.</div>}
        <div className="mt-8 space-y-3">
          {rows.map((r) => (
            <Link key={r.id} to={`/pozadavky/${r.id}`} className="block rounded-xl border bg-card p-4 hover:shadow-md">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold">č. {r.number} · {r.title}</p>
                <span className="rounded-full bg-secondary px-3 py-1 text-xs">{statusLabels[r.workflow_status] ?? r.workflow_status}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {typeLabels[r.type] ?? r.type} · {fmt(r.created_at)} · autor: {r.author ?? "bez jména"} · řešitel: {r.assignee ?? "nepřidělen"}
                {r.triage_priority ? ` · priorita: ${priorityLabels[r.triage_priority]}` : ""}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function RequestQueue() {
  return <RequireMember boardOnly><QueueInner /></RequireMember>;
}
