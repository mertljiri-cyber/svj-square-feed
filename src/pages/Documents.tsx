import { useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { categoryLabels, visibilityLabels, lifecycleLabels } from "@/features/documents/labels";

const PAGE = 25;
const selectClass = "h-10 rounded-md border border-input bg-background px-3 text-sm";

function DocumentsInner() {
  const { activeMembership, isBoard } = useAuth();
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [category, setCategory] = useState("");
  const [text, setText] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ title: "", category: "zapisy", visibility: "board", from: "", to: "" });
  const [message, setMessage] = useState("");

  // Hledání ve jménech jen mezi dokumenty, ke kterým má uživatel právo (RLS). Výpadek se hlásí jako chyba, ne jako prázdný archiv.
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
    queryKey: ["documents", category, text],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      let q = supabase.from("documents").select("*").order("created_at", { ascending: false }).range(pageParam, pageParam + PAGE - 1);
      if (category) q = q.eq("category", category);
      const term = text.trim().replace(/[%_\\]/g, (c) => `\\${c}`);
      if (term) q = q.ilike("title", `%${term}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
    getNextPageParam: (last, all) => (last.length === PAGE ? all.length * PAGE : undefined),
  });
  const docs = data?.pages.flat() ?? [];

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.rpc("create_document", {
      p_organization_id: orgId, p_title: form.title, p_category: form.category,
      p_period_from: form.from || null, p_period_to: form.to || null, p_visibility: form.visibility,
    });
    if (error) { setMessage(error.message); return; }
    setMessage("Dokument založen jako koncept. Otevřete jej a nahrajte soubor.");
    setCreating(false);
    setForm({ title: "", category: "zapisy", visibility: "board", from: "", to: "" });
    await qc.invalidateQueries({ queryKey: ["documents"] });
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Náš dům</p>
            <h1 className="text-3xl font-bold md:text-4xl">Dokumenty</h1>
            <p className="mt-3 max-w-2xl text-muted-foreground">Archiv dokumentů SVJ. Vidíte jen dokumenty, ke kterým máte přístup.</p>
          </div>
          {isBoard && <Button onClick={() => { setCreating(true); setMessage(""); }}>Nový dokument</Button>}
        </div>
        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}

        {creating && (
          <form onSubmit={create} className="my-8 space-y-4 rounded-xl border bg-card p-6">
            <h2 className="text-xl font-semibold">Nový dokument</h2>
            <label className="block text-sm font-medium">Název *<Input className="mt-1" required minLength={3} maxLength={200} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Kategorie<select className={`${selectClass} mt-1 w-full`} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>{Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="text-sm font-medium">Kdo smí číst<select className={`${selectClass} mt-1 w-full`} value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })}>{Object.entries(visibilityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label>
              <label className="text-sm font-medium">Období od<Input className="mt-1" type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value })} /></label>
              <label className="text-sm font-medium">Období do<Input className="mt-1" type="date" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} /></label>
            </div>
            <div className="flex gap-3"><Button type="submit">Založit koncept</Button><Button type="button" variant="outline" onClick={() => setCreating(false)}>Zrušit</Button></div>
          </form>
        )}

        <div className="my-8 flex flex-wrap gap-3">
          <Input aria-label="Hledat v názvech" className="max-w-sm" placeholder="Hledat v názvech" value={text} onChange={(e) => setText(e.target.value)} />
          <select aria-label="Kategorie" className={selectClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Všechny kategorie</option>
            {Object.entries(categoryLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        {isLoading && <p className="text-muted-foreground">Načítání…</p>}
        {error && <p role="alert" className="text-destructive">Dokumenty se nepodařilo načíst. Archiv tím není prázdný, zkuste to znovu.</p>}
        {!isLoading && !error && docs.length === 0 && <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Žádné dokumenty neodpovídají filtru.</div>}
        <div className="grid gap-4 md:grid-cols-2">
          {docs.map((d) => (
            <Link key={d.id} to={`/dokumenty/${d.id}`} className="block rounded-xl border bg-card p-5 hover:shadow-md">
              <p className="text-xs text-muted-foreground">{categoryLabels[d.category] ?? d.category}{d.period_from ? ` · ${new Date(d.period_from).toLocaleDateString("cs-CZ")}` : ""}</p>
              <h2 className="mt-1 font-semibold">{d.title}</h2>
              <p className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-secondary px-3 py-1">{lifecycleLabels[d.lifecycle] ?? d.lifecycle}</span>
                <span className="rounded-full bg-secondary px-3 py-1">{visibilityLabels[d.visibility] ?? d.visibility}</span>
              </p>
            </Link>
          ))}
        </div>
        {hasNextPage && <Button className="mt-6" variant="outline" disabled={isFetchingNextPage} onClick={() => fetchNextPage()}>Načíst další</Button>}
      </div>
    </Layout>
  );
}

export default function Documents() {
  return <RequireMember><DocumentsInner /></RequireMember>;
}
