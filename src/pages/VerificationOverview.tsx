import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ClipboardCheck, FileSearch } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import items from "@/data/technical-register.json";

type Draft = { method?: string; responsible?: string; due?: string };
type Drafts = Record<string, Draft>;
const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const dateLabel = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) ? date.split("-").reverse().join(".") : date;

export default function VerificationOverview() {
  const [drafts, setDrafts] = useState<Drafts>({});
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState("all");
  useEffect(() => {
    const next: Drafts = {};
    try {
      items.forEach((item) => {
        const raw = localStorage.getItem(`svj-technical-draft-${item.id}`);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid draft");
          const value = parsed as Record<string, unknown>;
          next[item.id] = { method: text(value.method), responsible: text(value.responsible), due: text(value.due) };
        }
      });
      setDrafts(next);
    } catch { setLoadError(true); }
  }, []);
  const unknown = items.filter((item) => item.state === "Nezjištěno").length;
  const missing = items.filter((item) => !text(item.state)).length;
  const filtered = items.filter((item) => {
    const draft = drafts[item.id];
    if (filter === "responsible") return !text(draft?.responsible);
    if (filter === "due") return !text(draft?.due);
    if (filter === "method") return !text(draft?.method);
    return true;
  });
  return <Layout><div className="page-container py-8">
    <Link to="/technicky-prehled" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary"><ArrowLeft className="h-4 w-4" />Technický přehled</Link>
    <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Náš dům</p><h1 className="text-3xl font-bold md:text-4xl">Revize a ověření</h1><p className="mt-3 max-w-3xl text-muted-foreground">Přehled neověřených prvků a rozpracovaných plánů jejich ověření.</p>
    <div className="my-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Pracovní náhled.</strong> Údaje o ověření pocházejí z návrhů uložených pouze v tomto prohlížeči; nejsou sdílené ani schválené. Nezjištěný stav není důkazem, že je prvek v pořádku.</div>
    <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Pojmenované prvky", items.length], ["Rezervní řádky", 4], ["Stav nezjištěn", unknown], ["Nevyplněný stav", missing]].map(([label, count]) => <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{count}</p></div>)}</div>
    <section className="mb-8 rounded-xl border bg-card p-6"><h2 className="flex items-center gap-2 text-xl font-semibold"><FileSearch className="h-5 w-5 text-primary" />Termíny revizí</h2><p className="mt-3 text-sm text-muted-foreground">Ve zdrojovém registru nejsou vyplněné doložené termíny revizí. Není tedy možné zobrazit, které revize jsou platné nebo po termínu.</p><p className="mt-2 text-sm text-muted-foreground">Termíny místních plánů ověření níže nejsou termíny zákonných ani odborných revizí.</p></section>
    <section><div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="flex items-center gap-2 text-xl font-semibold"><ClipboardCheck className="h-5 w-5 text-primary" />Plány ověření</h2><p className="mt-1 text-sm text-muted-foreground">Odpovědnost, termín a metoda jsou převzaté pouze z místního návrhu.</p></div><label className="flex items-center gap-2 text-sm">Zobrazit <select aria-label="Filtrovat chybějící údaje" value={filter} onChange={(event) => setFilter(event.target.value)} className="h-10 rounded-md border bg-background px-3"><option value="all">Všechny prvky</option><option value="responsible">Chybí odpovědnost</option><option value="due">Chybí termín</option><option value="method">Chybí způsob ověření</option></select></label></div>
      {loadError ? <p role="alert" className="rounded-xl border border-destructive p-5 text-destructive">Místní plány se nepodařilo načíst. Přehled chybějících údajů nelze spolehlivě sestavit.</p> : filtered.length === 0 ? <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Žádné prvky neodpovídají zvolenému filtru.</p> : <div className="grid gap-4 md:grid-cols-2">{filtered.map((item) => { const draft = drafts[item.id]; return <article key={item.id} className="rounded-xl border bg-card p-5"><p className="text-xs text-muted-foreground">{item.id} · {item.area}</p><h3 className="mt-1 font-semibold">{item.name}</h3><p className="mt-2 text-sm">Stav: <span className="font-medium">{item.state || "Nevyplněno"}</span> <span className="text-muted-foreground">· odborně nepotvrzeno</span></p><dl className="mt-4 space-y-2 border-t pt-4 text-sm"><div><dt className="inline text-muted-foreground">Způsob ověření: </dt><dd className="inline">{text(draft?.method) || "Nedoplněn"}</dd></div><div><dt className="inline text-muted-foreground">Odpovědnost: </dt><dd className="inline">{text(draft?.responsible) || "Nedoplněna"}</dd></div><div><dt className="inline text-muted-foreground">Termín návrhu: </dt><dd className="inline">{text(draft?.due) ? dateLabel(text(draft?.due)) : "Nedoplněn"}</dd></div></dl><Link className="mt-4 inline-block text-sm font-medium text-primary underline" to={`/technicky-prehled/${item.id}`}>Otevřít detail a plán ověření</Link></article>; })}</div>}
    </section><p className="mt-8 text-xs text-muted-foreground">Podklad: technický registr SVJ ze 7. 11. 2026. Čtyři rezervní řádky nejsou technické prvky.</p>
  </div></Layout>;
}
