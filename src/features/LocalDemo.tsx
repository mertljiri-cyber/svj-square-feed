import { useRef, useState } from 'react';
import { HouseChat, type ChatService } from './HouseChat';
import { answerQuestion, type Source } from '../../supabase/functions/ask-house/core';

// Deliberately synthetic. No auth client, credentials, AI gateway or backend.
const SOURCE: Source = {id: 'opravy:demo-v1:3', note_key: 'opravy', revision: 'demo-v1', title: 'Syntetické opravy', section: 'Zvonky', body: 'V modelovém domě byla schválena výměna zvonků. Termín realizace zatím není stanoven.'};
export default function LocalDemo() {
  const [role, setRole] = useState('obyvatel');
  const [page, setPage] = useState('uvod');
  const [scenario, setScenario] = useState('answer');
  const active = useRef(true);
  const [available, setAvailable] = useState(true);
  const [changed, setChanged] = useState('2026-11-21 00:00 · syntetický čas');
  const service: ChatService = {
    ask: async question => {
      await new Promise(resolve => setTimeout(resolve, 650));
      if (scenario === 'error' || scenario === 'limit') throw new Error(scenario);
      return answerQuestion(question, {
        search: async () => active.current && scenario !== 'unknown' ? [SOURCE] : [],
        generate: async () => ({kind: 'answer', claims: [{text: SOURCE.body, citations: [1]}]}),
        recheck: async () => active.current ? [SOURCE] : [],
      });
    },
    read: async citation => active.current && citation.id === SOURCE.id ? {...SOURCE} : null,
  };
  return <div className="min-h-screen bg-background text-foreground">
    <div className="bg-amber-100 px-4 py-3 text-sm text-amber-950">Lokální syntetické demo · bez přihlášení, AI a backendu · role nejsou bezpečnostní mechanismus</div>
    <header className="border-b bg-card"><div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 p-4">
      <a href="#uvod" className="text-xl font-bold" onClick={() => setPage('uvod')}>SVJ Square</a>
      <nav aria-label="Hlavní navigace" className="flex flex-wrap gap-4"><a href="#uvod" onClick={() => setPage('uvod')}>Úvod</a><a href="#chat" onClick={() => setPage('chat')}>Zeptat se</a><a href="#technika" onClick={() => setPage('technika')}>Technický přehled</a></nav>
      <label>Testovací role <select className="rounded border bg-background p-2" value={role} onChange={e => setRole(e.target.value)}><option value="obyvatel">Obyvatel</option><option value="vybor">Výbor</option></select></label>
    </div></header>
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      {page === 'uvod' && <><h1 className="text-3xl font-bold">Váš dům na jednom místě</h1><p>Dotazy s dohledatelnými úryvky a přehled techniky. Všechna zdejší data jsou smyšlená.</p><div className="grid gap-3 sm:grid-cols-2"><a className="rounded-lg bg-primary p-5 text-center font-semibold text-primary-foreground" href="#chat" onClick={() => setPage('chat')}>Zeptat se na dům</a><a className="rounded-lg border bg-card p-5 text-center font-semibold" href="#technika" onClick={() => setPage('technika')}>Prohlédnout technický přehled</a></div></>}
      {page === 'chat' && <><h1 className="text-3xl font-bold">Zeptat se na dům</h1><label className="block">Testovací scénář <select className="rounded border bg-background p-2" value={scenario} onChange={e => setScenario(e.target.value)}><option value="answer">Odpověď se zdrojem</option><option value="unknown">Bez zdrojů</option><option value="limit">Limit</option><option value="error">Chyba</option></select></label>
        {role === 'vybor' && <section aria-label="Správa zdrojů" className="space-y-3 rounded-xl border p-4"><h2 className="font-semibold">Správa zdrojů wiki (syntetická metadata)</h2><p>opravy · {available ? 'aktivní' : 'stažená'} · verze demo-v1</p><p>Poslední změna: {changed}</p><button className="rounded border p-2" onClick={() => {active.current = !active.current; setAvailable(active.current); setChanged(new Date().toLocaleString('cs'));}}>{available ? 'Stáhnout syntetickou poznámku' : 'Obnovit syntetickou poznámku'}</button></section>}
        <HouseChat key={role} service={service}/></>}
      {page === 'technika' && <><h1 className="text-3xl font-bold">Technický přehled</h1><article className="space-y-3 rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Zvonky · modelový vchod A</h2><p>Syntetický prvek DEMO-01. Toto demo neposílá požadavky.</p><p>V běžné aplikaci vede detail prvku do existujícího formuláře požadavku s předvyplněnou vazbou. Ten vyžaduje skutečné přihlášení a backend.</p></article></>}
    </main>
  </div>;
}
