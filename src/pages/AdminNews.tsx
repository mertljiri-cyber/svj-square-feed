import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RequireMember } from "@/features/auth/RequireMember";
import { useAuth } from "@/features/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { formatDate } from "@/lib/utils";

const visibilityLabels: Record<string, string> = { public: "Veřejně (i bez přihlášení)", owners: "Členům SVJ", board: "Pouze výboru" };
const statusLabels: Record<string, string> = { draft: "Koncept", published: "Publikováno" };
const selectClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";

type Draft = { id?: string; title: string; perex: string; content: string; tags: string; visibility: string; status: string; pinned: boolean; rowVersion?: number; publishedAt: string | null };
const blank = (): Draft => ({ title: "", perex: "", content: "", tags: "", visibility: "owners", status: "draft", pinned: false, publishedAt: null });

function NewsInner() {
  const { activeMembership } = useAuth();
  const orgId = activeMembership!.organization_id;
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [message, setMessage] = useState("");
  const [intro, setIntro] = useState<string | null>(null);

  const { data: news = [], isLoading, error } = useQuery({
    queryKey: ["admin-news", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("news").select("*").eq("organization_id", orgId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const { data: introRow } = useQuery({
    queryKey: ["admin-intro", orgId],
    queryFn: async () => {
      const { data, error } = await supabase.from("settings").select("*").eq("organization_id", orgId).eq("key", "intro_text").maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const refresh = () => Promise.all([qc.invalidateQueries({ queryKey: ["admin-news"] }), qc.invalidateQueries({ queryKey: ["news"] }), qc.invalidateQueries({ queryKey: ["settings"] })]);

  async function saveNews(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    const publishing = draft.status === "published";
    const payload = {
      title: draft.title.trim(), perex: draft.perex.trim() || null, content: draft.content.trim() || null,
      tags: draft.tags.split(",").map((t) => t.trim()).filter(Boolean), visibility: draft.visibility, status: draft.status,
      pinned: draft.pinned, published_at: publishing ? (draft.publishedAt ?? new Date().toISOString()) : null,
    };
    // Zápis hlídá databáze (publikace vyžaduje oprávnění ke schvalování); chybu ukážeme tak, jak ji vrátila.
    let error: { message: string } | null;
    if (draft.id) {
      // Podmínka na row_version brání tichému přepsání cizí úpravy; nula upravených řádků znamená konflikt.
      const res = await supabase.from("news").update(payload).eq("id", draft.id).eq("row_version", draft.rowVersion!).select("id");
      error = res.error ?? (res.data && res.data.length === 0 ? { message: "Novinku mezitím někdo změnil nebo smazal. Načtěte ji znovu." } : null);
    } else {
      error = (await supabase.from("news").insert({ ...payload, organization_id: orgId })).error;
    }
    if (error) { setMessage(error.message); return; }
    setMessage("Novinka uložena.");
    setDraft(null);
    await refresh();
  }

  async function removeNews(id: string) {
    if (!window.confirm("Opravdu smazat tuto novinku? Akci nelze vrátit.")) return;
    const { error } = await supabase.from("news").delete().eq("id", id);
    setMessage(error ? "Novinku se nepodařilo smazat." : "Novinka smazána.");
    await refresh();
  }

  async function saveIntro() {
    if (intro === null) return;
    const { error } = introRow
      ? await supabase.from("settings").update({ value: intro }).eq("id", introRow.id)
      : await supabase.from("settings").insert({ organization_id: orgId, key: "intro_text", value: intro, is_public: true });
    setMessage(error ? error.message : "Úvodní text uložen.");
    if (!error) { setIntro(null); await refresh(); }
  }

  return (
    <Layout>
      <div className="page-container py-8">
        <Link to="/sprava" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Správa</Link>
        <h1 className="text-3xl font-bold md:text-4xl">Novinky a úvodní text</h1>
        {message && <p role="status" className="mt-6 rounded-lg border p-3 text-sm">{message}</p>}

        <section className="mt-8 rounded-xl border bg-card p-6">
          <h2 className="text-lg font-semibold">Úvodní text portálu</h2>
          <p className="mt-1 text-sm text-muted-foreground">Zobrazuje se na úvodní stránce všem návštěvníkům, i nepřihlášeným.</p>
          <Textarea className="mt-3 min-h-24" maxLength={2000} value={intro ?? introRow?.value ?? ""} onChange={(e) => setIntro(e.target.value)} />
          <Button className="mt-3" onClick={saveIntro} disabled={intro === null}>Uložit úvodní text</Button>
        </section>

        <div className="mt-10 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Novinky</h2>
          <Button onClick={() => { setDraft(blank()); setMessage(""); }}>Nová novinka</Button>
        </div>

        {draft && (
          <form onSubmit={saveNews} className="my-6 space-y-4 rounded-xl border bg-card p-6">
            <h3 className="font-semibold">{draft.id ? "Upravit novinku" : "Nová novinka"}</h3>
            <label className="block text-sm font-medium">Název *<Input className="mt-1" required maxLength={200} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
            <label className="block text-sm font-medium">Perex<Textarea className="mt-1" maxLength={500} value={draft.perex} onChange={(e) => setDraft({ ...draft, perex: e.target.value })} /></label>
            <label className="block text-sm font-medium">Text<Textarea className="mt-1 min-h-40" value={draft.content} onChange={(e) => setDraft({ ...draft, content: e.target.value })} /></label>
            <label className="block text-sm font-medium">Štítky (oddělené čárkou)<Input className="mt-1" value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} /></label>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-medium">Kdo smí číst
                <select className={selectClass} value={draft.visibility} onChange={(e) => setDraft({ ...draft, visibility: e.target.value })}>
                  {Object.entries(visibilityLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
              <label className="text-sm font-medium">Stav
                <select className={selectClass} value={draft.status} onChange={(e) => setDraft({ ...draft, status: e.target.value })}>
                  {Object.entries(statusLabels).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.pinned} onChange={(e) => setDraft({ ...draft, pinned: e.target.checked })} />Připnout nahoru</label>
            {draft.status === "published" && draft.visibility === "public" && <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">Veřejná novinka je viditelná komukoli na internetu, i bez přihlášení.</p>}
            <div className="flex gap-3"><Button type="submit">Uložit</Button><Button type="button" variant="outline" onClick={() => setDraft(null)}>Zrušit</Button></div>
          </form>
        )}

        {isLoading && <p className="mt-6 text-muted-foreground">Načítání…</p>}
        {error && <p role="alert" className="mt-6 text-destructive">Novinky se nepodařilo načíst.</p>}
        <ul className="mt-6 space-y-3">
          {news.map((n) => (
            <li key={n.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
              <div>
                <p className="font-medium">{n.title}</p>
                <p className="text-sm text-muted-foreground">{statusLabels[n.status] ?? n.status} · {visibilityLabels[n.visibility] ?? n.visibility} · {formatDate(n.created_at)}</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={() => { setDraft({ id: n.id, title: n.title, perex: n.perex ?? "", content: n.content ?? "", tags: (n.tags ?? []).join(", "), visibility: n.visibility, status: n.status, pinned: !!n.pinned, rowVersion: n.row_version, publishedAt: n.published_at }); setMessage(""); }}>Upravit</Button>
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeNews(n.id)}>Smazat</Button>
              </div>
            </li>
          ))}
          {!isLoading && !error && news.length === 0 && <li className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Zatím žádné novinky.</li>}
        </ul>
      </div>
    </Layout>
  );
}

export default function AdminNews() {
  return <RequireMember boardOnly><NewsInner /></RequireMember>;
}
