import { useState } from "react";
import { ClipboardList, Plus } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import items from "@/data/technical-register.json";

type Event = { id: string; date: string; text: string };
type Request = { id: string; title: string; type: string; description: string; location: string; assetId: string; status: string; assignee: string; due: string; result: string; events: Event[] };
const storageKey = "svj-requests-demo-v1";
const makeEmpty = (): Request => ({ id: "", title: "", type: "Závada", description: "", location: "", assetId: "", status: "Nový", assignee: "", due: "", result: "", events: [] });
const selectClass = "mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm";
const statuses = ["Nový", "Posouzený", "V řešení", "Čeká se", "Vyřešený", "Uzavřený"];
const dateFormat = (v: string) => new Date(v).toLocaleString("cs-CZ", { dateStyle: "short", timeStyle: "short" });

export default function RequestsDemo() {
  const [requests, setRequests] = useState<Request[]>(() => { try { const data = localStorage.getItem(storageKey); if (!data) return []; const parsed: unknown = JSON.parse(data); return Array.isArray(parsed) ? parsed : []; } catch { return []; } });
  const [form, setForm] = useState<Request>(makeEmpty);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const [transition, setTransition] = useState({ status: "Nový", assignee: "", due: "", result: "" });
  const [note, setNote] = useState("");
  const selected = requests.find((request) => request.id === selectedId);
  const update = (field: keyof Request, value: string) => setForm((current) => ({ ...current, [field]: value }));
  function persist(next: Request[]) { try { localStorage.setItem(storageKey, JSON.stringify(next)); setRequests(next); setError(""); return true; } catch { setError("Uložení do prohlížeče se nezdařilo."); return false; } }
  function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.description.trim()) { setError("Vyplňte název a popis."); return; }
    const id = crypto.randomUUID();
    const request = { ...form, title: form.title.trim(), description: form.description.trim(), id, events: [{ id: crypto.randomUUID(), date: new Date().toISOString(), text: "Ukázkový požadavek uložen v tomto prohlížeči." }] };
    if (persist([request, ...requests])) { setSelectedId(id); setCreating(false); setForm(makeEmpty()); setTransition({ status: "Nový", assignee: "", due: "", result: "" }); }
  }
  function select(request: Request) { setSelectedId(request.id); setCreating(false); setTransition({ status: request.status, assignee: request.assignee, due: request.due, result: request.result }); setNote(""); setError(""); }
  function updateSimulation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected) return;
    if (transition.status === "Vyřešený" && !transition.result.trim()) { setError("Pro označení jako vyřešené doplňte výsledek."); return; }
    const changes = [`Stav: ${transition.status}`, transition.assignee && `řešitel: ${transition.assignee}`, transition.due && `termín: ${transition.due}`, transition.result && `výsledek: ${transition.result}`].filter(Boolean).join(" · ");
    const next = requests.map((request) => request.id === selected.id ? { ...request, ...transition, events: [...request.events, { id: crypto.randomUUID(), date: new Date().toISOString(), text: `Simulace vyřízení: ${changes}` }] } : request);
    persist(next);
  }
  function addNote(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!selected || !note.trim()) return;
    if (persist(requests.map((request) => request.id === selected.id ? { ...request, events: [...request.events, { id: crypto.randomUUID(), date: new Date().toISOString(), text: `Doplnění: ${note.trim()}` }] } : request))) setNote("");
  }
  return <Layout><div className="page-container py-8"><div className="flex flex-wrap justify-between gap-4"><div><p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Komunikace</p><h1 className="text-3xl font-bold md:text-4xl">Požadavky</h1><p className="mt-3 text-muted-foreground">Vyzkoušejte zadání a průběh vyřízení požadavku.</p></div><Button onClick={() => { setCreating(true); setSelectedId(null); setForm(makeEmpty()); setError(""); }}><Plus className="mr-2 h-4 w-4" />Nový ukázkový požadavek</Button></div>
    <div className="my-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Jen ukázka: nic se neodesílá výboru.</strong> Používejte pouze smyšlené údaje. Záznamy jsou uložené v tomto prohlížeči, nejsou chráněné přihlášením a mohou je vidět další uživatelé tohoto zařízení. Vymazání dat prohlížeče je odstraní. Přílohy a skutečné přidělování řešitele zatím nejsou dostupné.</div>
    {error && <p className="mb-4 text-sm text-destructive" role="alert">{error}</p>}
    {creating && <form onSubmit={create} className="mb-8 space-y-4 rounded-xl border bg-card p-6"><h2 className="text-xl font-semibold">Nový ukázkový požadavek</h2><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Typ<select className={selectClass} value={form.type} onChange={(e) => update("type", e.target.value)}><option>Závada</option><option>Dotaz</option><option>Návrh</option></select></label><label className="text-sm font-medium">Název *<Input className="mt-1" maxLength={120} value={form.title} onChange={(e) => update("title", e.target.value)} required /></label></div><label className="block text-sm font-medium">Popis *<Textarea className="mt-1" maxLength={3000} value={form.description} onChange={(e) => update("description", e.target.value)} required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Místo<Input className="mt-1" maxLength={120} value={form.location} onChange={(e) => update("location", e.target.value)} /></label><label className="text-sm font-medium">Technický prvek<select className={selectClass} value={form.assetId} onChange={(e) => update("assetId", e.target.value)}><option value="">Bez vazby</option>{items.map((item) => <option key={item.id} value={item.id}>{item.id} · {item.name}</option>)}</select></label></div><div className="flex gap-3"><Button type="submit">Uložit ukázku do prohlížeče</Button><Button type="button" variant="outline" onClick={() => setCreating(false)}>Zrušit</Button></div></form>}
    <div className="grid gap-6 lg:grid-cols-3"><section><h2 className="mb-4 text-xl font-semibold">Ukázkové požadavky <span className="text-muted-foreground">({requests.length})</span></h2>{requests.length ? <div className="space-y-3">{requests.map((request) => <button type="button" key={request.id} onClick={() => select(request)} className={`w-full rounded-xl border bg-card p-4 text-left hover:border-primary ${selectedId === request.id ? "border-primary" : ""}`}><span className="text-xs text-muted-foreground">Ukázka · {request.id.slice(0, 8)}</span><span className="mt-1 block font-semibold">{request.title}</span><span className="mt-1 block text-sm text-muted-foreground">{request.type} · {request.status}</span></button>)}</div> : <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground"><ClipboardList className="mb-3 h-6 w-6" />Zatím žádné ukázkové požadavky.</div>}</section>
    <section className="lg:col-span-2">{selected ? <div className="space-y-6"><div className="rounded-xl border bg-card p-6"><p className="text-xs text-muted-foreground">Ukázka · {selected.id.slice(0, 8)} · {selected.type}</p><h2 className="mt-1 text-2xl font-bold">{selected.title}</h2><p className="mt-3 whitespace-pre-wrap text-sm">{selected.description}</p><dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Místo</dt><dd>{selected.location || "Nedoplněno"}</dd></div><div><dt className="text-muted-foreground">Prvek</dt><dd>{items.find((item) => item.id === selected.assetId)?.name || "Bez vazby"}</dd></div><div><dt className="text-muted-foreground">Stav ukázky</dt><dd>{selected.status}</dd></div><div><dt className="text-muted-foreground">Řešitel v ukázce</dt><dd>{selected.assignee || "Nepřiřazen"}</dd></div></dl></div>
    <form onSubmit={updateSimulation} className="space-y-4 rounded-xl border bg-card p-6"><h3 className="text-lg font-semibold">Simulace vyřízení výborem</h3><p className="text-sm text-muted-foreground">Tyto změny slouží pouze k vyzkoušení obrazovky. Nikoho nepřiřazují a nic neschvalují.</p><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Stav<select className={selectClass} value={transition.status} onChange={(e) => setTransition({ ...transition, status: e.target.value })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-sm font-medium">Řešitel<Input className="mt-1" value={transition.assignee} onChange={(e) => setTransition({ ...transition, assignee: e.target.value })} /></label><label className="text-sm font-medium">Termín<Input className="mt-1" type="date" value={transition.due} onChange={(e) => setTransition({ ...transition, due: e.target.value })} /></label></div><label className="block text-sm font-medium">Výsledek řešení<Textarea className="mt-1" value={transition.result} onChange={(e) => setTransition({ ...transition, result: e.target.value })} /></label><Button type="submit" variant="outline">Uložit simulaci</Button></form>
    <section className="rounded-xl border bg-card p-6"><h3 className="mb-4 text-lg font-semibold">Historie ukázky</h3><ol className="space-y-3">{selected.events.map((event) => <li key={event.id} className="border-l-2 border-primary/30 pl-4 text-sm"><p className="text-xs text-muted-foreground">{dateFormat(event.date)}</p><p className="mt-1 whitespace-pre-wrap">{event.text}</p></li>)}</ol><form onSubmit={addNote} className="mt-5"><label className="block text-sm font-medium">Doplnění k ukázce<Textarea className="mt-1" value={note} onChange={(e) => setNote(e.target.value)} /></label><Button className="mt-3" type="submit" variant="outline" disabled={!note.trim()}>Uložit doplnění</Button></form></section></div> : <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground">Vyberte ukázkový požadavek nebo založte nový.</div>}</section></div>
  </div></Layout>;
}
