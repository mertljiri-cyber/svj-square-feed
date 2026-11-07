import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Wrench, MapPin } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Input } from "@/components/ui/input";
import items from "@/data/technical-register.json";

export default function TechnicalRegister() {
  const [search, setSearch] = useState("");
  const [criticality, setCriticality] = useState("Všechny");
  const filtered = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("cs");
    return items.filter((item) =>
      (criticality === "Všechny" || item.criticality === criticality) &&
      [item.id, item.area, item.name, item.location].some((value) => value.toLocaleLowerCase("cs").includes(query))
    );
  }, [search, criticality]);

  return (
    <Layout>
      <div className="page-container py-8">
        <div className="mb-8 max-w-3xl">
          <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-primary">Náš dům</p>
          <h1 className="mb-3 text-3xl font-bold md:text-4xl">Technický přehled</h1>
          <p className="text-muted-foreground">Přehled společných částí a technologií domu na jednom místě.</p>
        </div>
        <div className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          <strong>Pracovní náhled ze stávajícího registru.</strong> Stav prvků zatím nebyl ověřen. Kritičnost označuje význam prvku, nikoliv jeho aktuální závadu. Rozpracovaný plán ověření lze uložit pouze v tomto prohlížeči.
        </div>
        <div className="mb-8"><Link className="inline-flex rounded-lg border bg-card px-4 py-3 text-sm font-medium text-primary hover:bg-secondary" to="/revize-a-overeni">Zobrazit revize a chybějící ověření →</Link></div>
        <div className="mb-8 grid gap-4 sm:grid-cols-3">
          {[['Evidovaných prvků', items.length], ['Vysoká kritičnost', items.filter((item) => item.criticality === 'Vysoká').length], ['Stav k ověření', items.filter((item) => item.state === 'Nezjištěno').length]].map(([label, value]) => (
            <div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-1 text-3xl font-bold">{value}</p></div>
          ))}
        </div>
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Hledat technický prvek" placeholder="Hledat prvek, oblast nebo umístění" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" /></div>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">Kritičnost <select value={criticality} onChange={(e) => setCriticality(e.target.value)} className="h-10 rounded-md border bg-background px-3 text-foreground"><option>Všechny</option><option>Vysoká</option><option>Střední</option><option>Nízká</option></select></label>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">Zobrazeno {filtered.length} z {items.length} prvků</p>
        {filtered.length ? <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{filtered.map((item) => <Link to={`/technicky-prehled/${item.id}`} key={item.id} className="block rounded-xl border bg-card p-5 transition-shadow hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <div className="mb-4 flex items-start justify-between gap-3"><div className="rounded-lg bg-primary/10 p-2 text-primary"><Wrench className="h-5 w-5" /></div><span className="rounded-full bg-secondary px-3 py-1 text-xs font-medium">{item.criticality} kritičnost</span></div>
          <p className="mb-1 text-xs text-muted-foreground">{item.id} · {item.area}</p><h2 className="mb-3 font-semibold">{item.name}</h2>
          <p className="mb-4 flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{item.location}</p><p className="border-t pt-3 text-sm">Stav: <span className="font-medium">{item.state}</span></p>
        <p className="mt-3 text-sm font-medium text-primary">Zobrazit detail →</p></Link>)}</div> : <p className="rounded-xl border border-dashed p-8 text-center text-muted-foreground">Žádné prvky neodpovídají filtru.</p>}
        <p className="mt-8 text-xs text-muted-foreground">Zdroj: technický registr SVJ, podklad ze 7. 11. 2026. Čtyři prázdné rezervní řádky nejsou zobrazeny.</p>
      </div>
    </Layout>
  );
}
