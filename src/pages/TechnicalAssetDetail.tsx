import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, MapPin } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import items from "@/data/technical-register.json";

type Draft = { method: string; responsible: string; due: string; note: string };
const emptyDraft: Draft = { method: "", responsible: "", due: "", note: "" };

export default function TechnicalAssetDetail() {
  const { id } = useParams();
  const item = items.find((entry) => entry.id === id);
  const key = `svj-technical-draft-${id}`;
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState("");
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      setDraft(stored ? { ...emptyDraft, ...JSON.parse(stored) } : emptyDraft);
    } catch {
      setDraft(emptyDraft);
      setMessage("Místní návrh se nepodařilo načíst.");
    }
  }, [key]);
  if (!item) return <Layout><div className="page-container py-12"><h1 className="text-2xl font-bold">Prvek nebyl nalezen</h1><Link className="mt-4 inline-block text-primary underline" to="/technicky-prehled">Zpět na technický přehled</Link></div></Layout>;
  const missing = [!draft.method.trim() && "způsob ověření", !draft.responsible.trim() && "odpovědná osoba", !draft.due && "termín"].filter(Boolean);
  function saveDraft() {
    try {
      localStorage.setItem(key, JSON.stringify(draft));
      setMessage("Rozpracovaný plán byl uložen v tomto prohlížeči.");
    } catch { setMessage("Plán se nepodařilo uložit. Zkontrolujte nastavení úložiště prohlížeče."); }
  }
  const update = (field: keyof Draft, value: string) => { setDraft((previous) => ({ ...previous, [field]: value })); setMessage(""); };
  return <Layout><div className="page-container py-8">
    <Link to="/technicky-prehled" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Technický přehled</Link>
    <p className="mb-2 text-sm font-medium text-primary">{item.id} · {item.area}</p>
    <h1 className="mb-3 text-3xl font-bold md:text-4xl">{item.name}</h1>
    <p className="mb-8 flex items-center gap-2 text-muted-foreground"><MapPin className="h-4 w-4" />{item.location}</p>
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <section className="rounded-xl border bg-card p-6"><h2 className="mb-4 text-xl font-semibold">Technický stav</h2><div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-950"><p className="font-semibold">{item.state}</p><p className="mt-1 text-sm">Převzato ze zdrojového registru. Stav nebyl odborně potvrzen.</p></div><dl className="mt-5 grid gap-4 sm:grid-cols-2"><div><dt className="text-sm text-muted-foreground">Kritičnost prvku</dt><dd className="font-medium">{item.criticality}</dd></div><div><dt className="text-sm text-muted-foreground">Podklad a datum hodnocení</dt><dd className="font-medium">Nedoplněno</dd></div></dl><p className="mt-4 text-sm text-muted-foreground">Kritičnost vyjadřuje význam prvku, ne aktuální stav ani naléhavost opravy.</p></section>
        <section className="rounded-xl border bg-card p-6"><div className="mb-3 flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" /><h2 className="text-xl font-semibold">Plán ověření</h2></div><p className="mb-5 text-sm text-muted-foreground">Rozpracovaný návrh se ukládá pouze v tomto prohlížeči a není sdílený s výborem ani ostatními členy.</p>
          <div className="space-y-4"><label className="block text-sm font-medium">Způsob ověření<Input className="mt-1" value={draft.method} onChange={(e) => update("method", e.target.value)} placeholder="Např. prohlídka odborníkem" /></label><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-medium">Odpovědná osoba<Input className="mt-1" value={draft.responsible} onChange={(e) => update("responsible", e.target.value)} placeholder="Doplnit odpovědnost" /></label><label className="block text-sm font-medium">Termín<Input className="mt-1" type="date" value={draft.due} onChange={(e) => update("due", e.target.value)} /></label></div><label className="block text-sm font-medium">Poznámka<Textarea className="mt-1" value={draft.note} onChange={(e) => update("note", e.target.value)} placeholder="Co je třeba prověřit?" /></label></div>
          <p className="mt-4 text-sm text-muted-foreground">{missing.length ? `K doplnění: ${missing.join(", ")}.` : "Základní údaje návrhu jsou vyplněné; plán zatím není schválený."}</p><Button className="mt-4" onClick={saveDraft}>Uložit rozpracovaný plán</Button><p className="mt-2 text-sm" role="status">{message}</p>
        </section>
      </div>
      <aside className="space-y-6"><section className="rounded-xl border bg-card p-6"><h2 className="mb-3 font-semibold">Historie a podklady</h2><p className="text-sm text-muted-foreground">Ve zdrojovém registru nejsou vyplněny podklady ani historie hodnocení. Archiv dokumentů zatím není připojen.</p></section><section className="rounded-xl border bg-card p-6"><h2 className="mb-3 font-semibold">Související opravy a požadavky</h2><p className="text-sm text-muted-foreground">Sdílené vazby zatím nejsou k dispozici. To neznamená, že žádné opravy nebo požadavky neexistují.</p><Link className="mt-4 inline-block text-sm font-medium text-primary underline" to={`/plan-oprav?prvek=${item.id}`}>Otevřít plán oprav</Link></section></aside>
    </div><p className="mt-8 text-xs text-muted-foreground">Pracovní náhled podle technického registru SVJ, podklad ze 7. 11. 2026.</p>
  </div></Layout>;
}
