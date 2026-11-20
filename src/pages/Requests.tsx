import assets from "@/data/technical-register.json";
import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { typeLabels, statusLabels, fmt } from "@/features/requests/labels";
import { emptyRequestDraft, requestDraftForAsset } from "@/features/requests/assetDraft";

function RequestsInner() {
  const { session, activeMembership, isBoard } = useAuth();
  const userId = session!.user.id;
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const assetRef = searchParams.get("prvek");
  const [open, setOpen] = useState(() => !!requestDraftForAsset(assetRef, assets));
  const [form, setForm] = useState(() => requestDraftForAsset(assetRef, assets) ?? emptyRequestDraft());
  const [createdRequest, setCreatedRequest] = useState<{ id: string; number: number } | null>(null);
  // Klíč se mění až po úspěšném odeslání, takže opakované kliknutí nezaloží druhý požadavek.
  const [key, setKey] = useState(() => crypto.randomUUID());
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);

  useEffect(() => {
    const draft = requestDraftForAsset(assetRef, assets);
    if (!draft) return;
    setForm(draft);
    setOpen(true);
    setCreatedRequest(null);
    setMessage("");
    // Consume the prefill so cancel/success and refresh cannot reopen an old draft.
    const next = new URLSearchParams(searchParams);
    next.delete("prvek");
    setSearchParams(next, { replace: true });
  }, [assetRef, searchParams, setSearchParams]);

  const { data: requests = [], isLoading, error } = useQuery({
    queryKey: ["my-requests", userId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("requests").select("*").eq("author_user_id", userId).eq("organization_id", orgId).order("updated_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setMessage("");
    try {
      const { data, error } = await supabase.rpc("create_request", {
        p_organization_id: orgId, p_type: form.type, p_title: form.title, p_description: form.description,
        p_location: form.location || null, p_asset_ref: form.asset_ref || null, p_idempotency_key: key,
      });
      if (error) { setMessage(error.message); return; }
      const created = data as unknown as { id: string; number: number };
      setMessage(`Požadavek č. ${created.number} byl přijat.`);
      setCreatedRequest(created);
      setForm(emptyRequestDraft());
      setKey(crypto.randomUUID());
      setOpen(false);
      // A refresh failure must not turn an acknowledged submission into an error.
      await qc.invalidateQueries({ queryKey: ["my-requests", userId, orgId] }).catch(() => {});
    } catch {
      setMessage("Odeslání se nepodařilo ověřit. Zkuste to znovu; stejný požadavek se neodešle dvakrát.");
    } finally {
      submitting.current = false;
      setBusy(false);
    }
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
            <Button onClick={() => { setOpen(true); setMessage(""); setCreatedRequest(null); }}>Nový požadavek</Button>
          </div>
        </div>

        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}
        {createdRequest && <Link className="mt-3 inline-block text-sm font-medium text-primary underline" to={`/pozadavky/${createdRequest.id}`}>Otevřít přijatý požadavek č. {createdRequest.number}</Link>}

        {open && (
          <form onSubmit={submit} className="my-8 space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Nový požadavek</h2>
            {form.asset_ref && <p className="text-sm text-muted-foreground">Vazba na prvek: <Link className="text-primary underline" to={`/technicky-prehled/${encodeURIComponent(form.asset_ref)}`}>{form.asset_ref}</Link>. Zkontrolujte údaje a doplňte popis; zatím nebylo nic odesláno.</p>}
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
              <label className="text-sm font-medium">Technický prvek (nepovinný)<Input className="mt-1" list="svj-assets" pattern="[A-Z]{1,3}-[0-9]{3}" value={form.asset_ref} onChange={(e) => setForm({ ...form, asset_ref: e.target.value })} /><datalist id="svj-assets">{assets.map(asset => <option key={asset.id} value={asset.id} label={asset.name} />)}</datalist></label>
            </div>
            <p className="text-xs text-muted-foreground">Přílohy zatím nejsou dostupné. Neuvádějte hesla ani citlivé osobní údaje.</p>
            <div className="flex gap-3">
              <Button type="submit" disabled={busy}>Odeslat požadavek</Button>
              <Button type="button" variant="outline" disabled={busy} onClick={() => setOpen(false)}>Zrušit</Button>
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
                <p className="mt-3 text-xs text-muted-foreground">Poslední změna: <time dateTime={r.updated_at}>{fmt(r.updated_at)}</time></p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}

export default function Requests() {
  const {session, activeMembership} = useAuth();
  return <RequireMember><RequestsInner key={`${session?.user.id}:${activeMembership?.organization_id}`} /></RequireMember>;
}
