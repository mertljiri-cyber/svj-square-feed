import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { typeLabels, statusLabels, fmt } from "@/features/requests/labels";

function RequestsInner() {
  const { session, activeMembership, isBoard } = useAuth();
  const userId = session!.user.id;
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "defect", title: "", description: "", location: "", asset_ref: "" });
  // Klíč se mění až po úspěšném odeslání, takže opakované kliknutí nezaloží druhý požadavek.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["my-requests", userId],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("author_user_id", userId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { data, error } = await supabase.rpc("create_request", {
      p_organization_id: orgId, p_type: form.type, p_title: form.title, p_description: form.description,
      p_location: form.location || null, p_asset_ref: form.asset_ref.trim().toUpperCase() || null, p_idempotency_key: key,
    });
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    const created = data as unknown as { id: string; number: number };
    setMessage(`Požadavek č. ${created.number} byl přijat.`);
    setForm({ type: "defect", title: "", description: "", location: "", asset_ref: "" });
    setKey(crypto.randomUUID());
    setOpen(false);
    await qc.invalidateQueries({ queryKey: ["my-requests", userId] });
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Komunikace</p>
            <h1 className="text-3xl font-bold md:text-4xl">Moje požadavky</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Závady, dotazy a návrhy. Požadavek vidíte jen vy, výbor a přidělený řešitel. Portál nenahrazuje havarijní službu.</p>
          </div>
          <div className="flex gap-3">
            {isBoard && <Button asChild variant="outline"><Link to="/pozadavky/fronta">Fronta výboru</Link></Button>}
            <Button onClick={() => { setOpen(true); setMessage(""); }}>Nový požadavek</Button>
          </div>
        </div>

        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}

        {open && (
          <form onSubmit={submit} className="my-8 space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Nový požadavek</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Typ
                <select className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(typeLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Název *<Input className="mt-1" required minLength={3} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            </div>
            <label className="block text-sm font-medium">Popis *<Textarea className="mt-1" required minLength={3} maxLength={5000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Místo<Input className="mt-1" maxLength={120} value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></label>
              <label className="text-sm font-medium">Označení technického prvku (např. T-013)<Input className="mt-1" pattern="[A-Za-z]{1,3}-[0-9]{3}" value={form.asset_ref} onChange={(e) => setForm({ ...form, asset_ref: e.target.value })} /></label>
            </div>
            <p className="text-xs text-muted-foreground">Přílohy zatím nejsou dostupné. Neuvádějte hesla ani citlivé osobní údaje.</p>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>Odeslat požadavek</Button>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Zrušit</Button>
            </div>
          </form>
        )}

        <div className="mt-8">
          {isLoading && <p className="text-muted-foreground">Načítání…</p>}
          {error && <p role="alert" className="text-destructive">Požadavky se nepodařilo načíst.</p>}
          {!isLoading && !error && requests.length === 0 && (
            <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Zatím jste nepodali žádný požadavek.</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            {requests.map((r) => (
              <Link key={r.id} to={`/pozadavky/${r.id}`} className="block rounded-xl border bg-card p-5 hover:shadow-md">
                <p className="text-xs text-muted-foreground">č. {r.number} · {typeLabels[r.type] ?? r.type} · {fmt(r.created_at)}</p>
                <h2 className="mt-1 font-semibold">{r.title}</h2>
                <p className="mt-3 text-sm"><span className="rounded-full bg-secondary px-3 py-1">{statusLabels[r.workflow_status] ?? r.workflow_status}</span></p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function Requests() {
  return <RequireMember><RequestsInner /></RequireMember>;
}
