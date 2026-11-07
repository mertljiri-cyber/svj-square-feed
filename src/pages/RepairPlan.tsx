import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarDays, Plus, Wrench } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import items from "@/data/technical-register.json";

type Repair = { id: string; title: string; assetId: string; reason: string; priority: string; year: string; cost: string; nextStep: string; responsible: string };
const storageKey = "svj-repair-plan-drafts-v1";
const blank = (assetId = ""): Repair => ({ id: "", title: "", assetId, reason: "", priority: "", year: "", cost: "", nextStep: "", responsible: "" });
const inputClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const money = (value: number) => new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 2 }).format(value);

export default function RepairPlan() {
  const [params] = useSearchParams();
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [draft, setDraft] = useState<Repair>(() => blank(params.get("prvek") || ""));
  const [editing, setEditing] = useState(() => Boolean(params.get("prvek")));
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("Invalid data");
        setRepairs(parsed);
      }
    } catch { setLoadError(true); setMessage("Místní plán se nepodařilo načíst. Ukládání je vypnuté, aby nedošlo k přepsání dat."); }
  }, []);
  const update = (field: keyof Repair, value: string) => { setDraft((previous) => ({ ...previous, [field]: value })); setMessage(""); };
  function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.title.trim() || !items.some((item) => item.id === draft.assetId)) { setMessage("Vyplňte název a vyberte technický prvek."); return; }
    if (draft.year && (!/^\d{4}$/.test(draft.year) || Number(draft.year) < 1900 || Number(draft.year) > 2100)) { setMessage("Zadejte platný rok mezi 1900 a 2100."); return; }
    if (draft.cost && (!/^\d+(?:[.,]\d{1,2})?$/.test(draft.cost) || !Number.isFinite(Number(draft.cost.replace(",", "."))))) { setMessage("Zadejte nezáporný odhad v Kč, nejvýše se dvěma desetinnými místy."); return; }
    const next = draft.id ? repairs.map((r) => r.id === draft.id ? draft : r) : [...repairs, { ...draft, id: crypto.randomUUID() }];
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setRepairs(next); setDraft(blank()); setEditing(false); setMessage("Návrh byl uložen v tomto prohlížeči."); } catch { setMessage("Návrh se nepodařilo uložit. Zkontrolujte úložiště prohlížeče."); }
  }
  const years = [...new Set(repairs.map((r) => r.year).filter(Boolean))].sort();
  const groups = [...years, ...(repairs.some((r) => !r.year) ? [""] : [])];
  const estimated = repairs.filter((r) => r.cost !== "");
  const total = estimated.reduce((sum, r) => sum + Number(r.cost.replace(",", ".")), 0);
  return <Layout><div className="page-container py-8">
    <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Náš dům</p><div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-bold md:text-4xl">Plán oprav</h1><p className="mt-3 text-muted-foreground">Víceletý přehled navržených oprav a dalších kroků.</p></div><Button onClick={() => { setDraft(blank()); setEditing(true); setMessage(""); }}><Plus className="mr-2 h-4 w-4" />Nový návrh</Button></div>
    <div className="my-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Pracovní náhled.</strong> Návrhy se ukládají pouze v tomto prohlížeči, nejsou sdílené ani schválené. Jejich smazání z úložiště prohlížeče je odstraní. Zdrojový plán oprav zatím neobsahuje žádné akce.</div>
    <div className="mb-8 grid gap-4 sm:grid-cols-3"><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Rozpracované návrhy</p><p className="mt-1 text-3xl font-bold">{repairs.length}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Součet zadaných odhadů</p><p className="mt-1 text-2xl font-bold">{estimated.length ? money(total) : "Není k dispozici"}</p></div><div className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">Bez odhadu nákladů</p><p className="mt-1 text-3xl font-bold">{repairs.length - estimated.length}</p></div></div>
    {editing && <form onSubmit={save} className="mb-8 space-y-4 rounded-xl border bg-card p-6"><h2 className="text-xl font-semibold">{draft.id ? "Upravit návrh" : "Nový návrh opravy"}</h2><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Název akce *<Input className="mt-1" value={draft.title} onChange={(e) => update("title", e.target.value)} required /></label><label className="text-sm font-medium">Technický prvek *<select required className={inputClass} value={draft.assetId} onChange={(e) => update("assetId", e.target.value)}><option value="">Vyberte prvek</option>{items.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label></div>
    <label className="block text-sm font-medium">Důvod návrhu<Textarea className="mt-1" value={draft.reason} onChange={(e) => update("reason", e.target.value)} /></label><div className="grid gap-4 sm:grid-cols-3"><label className="text-sm font-medium">Priorita<select className={inputClass} value={draft.priority} onChange={(e) => update("priority", e.target.value)}><option value="">Neurčena</option><option>P1 – ihned</option><option>P2 – do 1 roku</option><option>P3 – 1–3 roky</option><option>P4 – 3–5 let</option><option>P5 – více než 5 let</option><option>Sledovat</option></select></label><label className="text-sm font-medium">Plánovaný rok<Input className="mt-1" type="number" min="1900" max="2100" step="1" placeholder="Neurčen" value={draft.year} onChange={(e) => update("year", e.target.value)} /></label><label className="text-sm font-medium">Odhad nákladů (Kč)<Input className="mt-1" inputMode="decimal" placeholder="Neodhadnuto" value={draft.cost} onChange={(e) => update("cost", e.target.value)} /></label></div><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Další krok<Input className="mt-1" value={draft.nextStep} onChange={(e) => update("nextStep", e.target.value)} /></label><label className="text-sm font-medium">Odpovědná osoba<Input className="mt-1" value={draft.responsible} onChange={(e) => update("responsible", e.target.value)} /></label></div><div className="flex gap-3"><Button disabled={loadError} type="submit">Uložit návrh</Button><Button type="button" variant="outline" onClick={() => { setEditing(false); setMessage(""); }}>Zrušit</Button></div></form>}
    <p className="mb-4 text-sm" role="status">{message}</p>
    {!repairs.length ? <div className="rounded-xl border border-dashed p-10 text-center"><CalendarDays className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><h2 className="font-semibold">Zatím tu nejsou žádné návrhy</h2><p className="mt-2 text-sm text-muted-foreground">Přidejte první návrh nebo vyberte prvek v technickém přehledu.</p><Link className="mt-4 inline-block text-sm font-medium text-primary underline" to="/technicky-prehled">Otevřít technický přehled</Link></div> : <div className="space-y-8">{groups.map((year) => <section key={year || "unscheduled"}><h2 className="mb-3 flex items-center gap-2 text-xl font-semibold"><CalendarDays className="h-5 w-5 text-primary" />{year || "Rok neurčen"}</h2><div className="grid gap-4 md:grid-cols-2">{repairs.filter((r) => r.year === year).map((repair) => { const asset = items.find((item) => item.id === repair.assetId); return <article key={repair.id} className="rounded-xl border bg-card p-5"><div className="flex justify-between gap-3"><h3 className="font-semibold">{repair.title}</h3><span className="h-fit rounded-full bg-secondary px-2 py-1 text-xs">Návrh</span></div><p className="mt-2 flex gap-2 text-sm text-muted-foreground"><Wrench className="h-4 w-4 shrink-0" />{asset ? <Link className="text-primary hover:underline" to={`/technicky-prehled/${asset.id}`}>{asset.id} · {asset.name}</Link> : "Prvek není dostupný"}</p><dl className="mt-4 space-y-2 text-sm"><div><dt className="inline text-muted-foreground">Priorita: </dt><dd className="inline">{repair.priority || "Neurčena"}</dd></div><div><dt className="inline text-muted-foreground">Odhad: </dt><dd className="inline">{repair.cost !== "" ? money(Number(repair.cost.replace(",", "."))) : "Neodhadnuto"}</dd></div><div><dt className="inline text-muted-foreground">Další krok: </dt><dd className="inline">{repair.nextStep || "Nedoplněn"}</dd></div>{repair.responsible && <div><dt className="inline text-muted-foreground">Odpovědnost: </dt><dd className="inline">{repair.responsible}</dd></div>}{repair.reason && <div><dt className="inline text-muted-foreground">Důvod: </dt><dd className="inline whitespace-pre-wrap">{repair.reason}</dd></div>}</dl><Button className="mt-4" variant="outline" size="sm" onClick={() => { setDraft(repair); setEditing(true); setMessage(""); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Upravit návrh</Button></article>; })}</div></section>)}</div>}
  </div></Layout>;
}
