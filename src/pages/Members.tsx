import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

type Member = {
  membership_id: string; user_id: string; email: string; display_name: string | null; status: string;
  row_version: number; roles: { id: string; role: string }[]; grants: { id: string; scope: string; permission: string }[];
};
const roleLabels: Record<string, string> = { owner: "Vlastník", board: "Výbor", manager: "Správce", technical: "Technik", system_admin: "Technická správa" };
const statusLabels: Record<string, string> = { invited: "Čeká na schválení", active: "Aktivní", suspended: "Pozastaven", ended: "Ukončen" };

function MembersInner() {
  const { activeMembership } = useAuth();
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [message, setMessage] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLink, setInviteLink] = useState("");

  const { data: members = [], isLoading, error } = useQuery({
    queryKey: ["members", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_members", { p_organization_id: orgId });
      if (error) throw error;
      return data as unknown as Member[];
    },
  });

  // Každá změna jde přes RPC s očekávanou verzí; konflikt se hlásí, data se nepřepisují.
  async function run(label: string, promise: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await promise;
    setMessage(error ? error.message : label);
    await qc.invalidateQueries({ queryKey: ["members", orgId] });
  }

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    const { data, error } = await supabase.rpc("create_invitation", { p_organization_id: orgId, p_email: inviteEmail, p_role: "owner", p_valid_days: 7 });
    if (error) { setMessage(error.message); return; }
    const token = (data as unknown as { token: string }).token;
    // Odkaz obsahuje token ve fragmentu; zobrazí se jen jednou, v databázi je uložen pouze hash.
    setInviteLink(`${window.location.origin}/prihlaseni#pozvanka=${token}`);
    setInviteEmail("");
    setMessage("Pozvánka vytvořena. Odkaz předejte pozvanému osobně; zobrazí se pouze teď.");
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <h1 className="text-3xl font-bold mb-2">Členové a role</h1>
        <p className="text-muted-foreground mb-8">Schvalování členství a přidělování rolí. Každou změnu zapisuje audit.</p>
        {message && <p role="status" className="mb-4 text-sm">{message}</p>}

        <form onSubmit={invite} className="mb-8 flex flex-wrap gap-3 items-end rounded-xl border bg-card p-5">
          <label className="text-sm font-medium flex-1 min-w-64">Pozvat vlastníka (e-mail)<Input className="mt-1" type="email" required value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} /></label>
          <Button type="submit">Vytvořit pozvánku</Button>
        </form>
        {inviteLink && <p className="mb-8 break-all rounded-lg border p-3 text-sm">{inviteLink}</p>}

        {isLoading && <p className="text-muted-foreground">Načítání…</p>}
        {error && <p className="text-destructive">Seznam členů se nepodařilo načíst.</p>}
        <div className="space-y-4">
          {members.map((m) => (
            <div key={m.membership_id} className="rounded-xl border bg-card p-5">
              <div className="flex flex-wrap justify-between gap-3">
                <div><p className="font-medium">{m.display_name || m.email}</p><p className="text-sm text-muted-foreground">{m.email} · {statusLabels[m.status] ?? m.status}</p></div>
                <div className="flex flex-wrap gap-2">
                  {m.status === "invited" && <Button size="sm" onClick={() => run("Členství schváleno.", supabase.rpc("set_membership_status", { p_membership_id: m.membership_id, p_status: "active", p_expected_row_version: m.row_version }))}>Schválit</Button>}
                  {m.status === "active" && <Button size="sm" variant="outline" onClick={() => run("Členství pozastaveno.", supabase.rpc("set_membership_status", { p_membership_id: m.membership_id, p_status: "suspended", p_expected_row_version: m.row_version }))}>Pozastavit</Button>}
                  {m.status === "suspended" && <Button size="sm" variant="outline" onClick={() => run("Členství obnoveno.", supabase.rpc("set_membership_status", { p_membership_id: m.membership_id, p_status: "active", p_expected_row_version: m.row_version }))}>Obnovit</Button>}
                  {m.status !== "ended" && <Button size="sm" variant="ghost" onClick={() => run("Členství ukončeno.", supabase.rpc("set_membership_status", { p_membership_id: m.membership_id, p_status: "ended", p_expected_row_version: m.row_version }))}>Ukončit</Button>}
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-sm">
                {m.roles.map((r) => (
                  <span key={r.id} className="rounded-full bg-secondary px-3 py-1">
                    {roleLabels[r.role] ?? r.role}
                    {r.role !== "system_admin" && <button className="ml-2 text-muted-foreground underline" onClick={() => run("Role odebrána.", supabase.rpc("revoke_role", { p_role_id: r.id }))}>odebrat</button>}
                  </span>
                ))}
                {(["board", "manager", "technical"] as const).filter((role) => !m.roles.some((r) => r.role === role)).map((role) => (
                  <button key={role} className="rounded-full border px-3 py-1 text-muted-foreground" onClick={() => run("Role přidělena.", supabase.rpc("grant_role", { p_membership_id: m.membership_id, p_role: role }))}>+ {roleLabels[role]}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}

export default function Members() {
  return <RequireMember boardOnly><MembersInner /></RequireMember>;
}
