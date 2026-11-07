import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { formatDateTime } from "@/lib/utils";

const PAGE = 50;
const objectLabels: Record<string, string> = {
  memberships: "Členství", membership_roles: "Role", scoped_grants: "Delegace", invitations: "Pozvánky",
  news: "Novinky", intents: "Záměry", forms: "Formuláře", settings: "Nastavení", requests: "Požadavky",
  documents: "Dokumenty", document_versions: "Verze dokumentů", document_grants: "Přístup k dokumentům", organizations: "Organizace",
};
const actionLabels: Record<string, string> = {
  insert: "vytvořeno", update: "změněno", delete: "smazáno", download: "staženo", bootstrap_first_board: "založen první výbor",
};
type Member = { user_id: string; email: string; display_name: string | null };

// Z auditní položky ukážeme jen názvy změněných polí; hodnoty citlivých textů se do auditu neukládají.
function summary(details: unknown): string {
  if (!details || typeof details !== "object") return "";
  const keys = Object.keys(details as Record<string, unknown>).filter((k) => !["user_id"].includes(k));
  return keys.length ? keys.slice(0, 6).join(", ") + (keys.length > 6 ? " …" : "") : "";
}

function AuditInner() {
  const { activeMembership } = useAuth();
  const orgId = activeMembership!.organization_id;
  const [type, setType] = useState("");

  const { data: members = [] } = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members", { p_organization_id: orgId });
      if (error) throw error;
      return data as unknown as Member[];
    },
  });
  const who = new Map(members.map((m) => [m.user_id, m.display_name || m.email]));

  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["audit", orgId, type],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from("audit_events").select("*").eq("organization_id", orgId).order("occurred_at", { ascending: false }).range(pageParam, pageParam + PAGE - 1);
      if (type) q = q.eq("object_type", type);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const rows = data?.pages.flat() ?? [];

  return (
    <Layout>
      <div className="page-container py-8">
        <Link to="/sprava" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Správa</Link>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold md:text-4xl">Záznam změn</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Audit je jen ke čtení a nelze jej měnit ani mazat. Texty a obsah dokumentů se do něj neukládají, jen názvy změněných polí.</p>
          </div>
          <label className="text-sm">Oblast
            <select className="ml-2 h-10 rounded-md border bg-background px-3" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">Vše</option>
              {Object.entries(objectLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
        </div>

        {isLoading && <p className="mt-8 text-muted-foreground">Načítání…</p>}
        {error && <p role="alert" className="mt-8 text-destructive">Záznam se nepodařilo načíst. Neznamená to, že je prázdný.</p>}
        {!isLoading && !error && rows.length === 0 && <div className="mt-8 rounded-xl border border-dashed p-10 text-center text-muted-foreground">Žádné záznamy.</div>}
        <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-muted-foreground">
              <tr><th className="p-3">Kdy</th><th className="p-3">Kdo</th><th className="p-3">Oblast</th><th className="p-3">Akce</th><th className="p-3">Pole</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="p-3 whitespace-nowrap">{formatDateTime(r.occurred_at)}</td>
                  <td className="p-3">{r.actor_user_id ? who.get(r.actor_user_id) ?? "Člen SVJ" : "Systém"}</td>
                  <td className="p-3">{objectLabels[r.object_type] ?? r.object_type}</td>
                  <td className="p-3">{actionLabels[r.action] ?? r.action}</td>
                  <td className="p-3 text-muted-foreground">{summary(r.details)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {hasNextPage && <Button className="mt-6" variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>Načíst starší</Button>}
      </div>
    </Layout>
  );
}

export default function AdminAudit() {
  return <RequireMember boardOnly><AuditInner /></RequireMember>;
}
