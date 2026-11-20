import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { FixtureAuth, useFixtureRole } from './local-fixtures/auth';
import { fixture } from './local-fixtures/client';
import Index from '@/pages/Index';
import AskHouse from '@/pages/AskHouse';
import TechnicalRegister from '@/pages/TechnicalRegister';
import TechnicalAssetDetail from '@/pages/TechnicalAssetDetail';
import Requests from '@/pages/Requests';
import RequestDetail from '@/pages/RequestDetail';
const client = new QueryClient({defaultOptions: {queries: {retry: false}}});
function Controls() {
  const {role, setRole} = useFixtureRole();
  const qc = useQueryClient();
  const [scenario, setScenario] = useState('answer');
  return <aside className="space-y-2 border-b bg-amber-100 px-4 py-3 text-sm text-amber-950">
    <p>Lokální syntetické UI fixture · skutečné komponenty aplikace, simulovaný backend/identity/AI · data pouze v paměti do obnovení stránky · nejde o bezpečnostní test serveru</p>
    <div className="flex flex-wrap items-center gap-3"><label>Testovací role <select className="rounded border p-2" value={role} onChange={e => {qc.clear(); setRole(e.target.value);}}><option value="owner">Obyvatel</option><option value="board">Výbor</option><option value="other">Jiný obyvatel</option></select></label>
    <label>Testovací scénář <select className="rounded border p-2" value={scenario} onChange={e => {fixture.scenario = e.target.value; setScenario(e.target.value);}}><option value="answer">Odpověď se zdrojem</option><option value="unknown">Bez zdrojů</option><option value="limit">Limit</option><option value="error">Chyba</option></select></label>
    <button className="rounded border border-amber-800 px-3 py-2" onClick={() => {if (role === 'board') {fixture.active = false; fixture.audit.push({id: fixture.audit.length + 1, organization_id: 'synthetic-org', object_type: 'house_markdown', object_id: 'opravy', action: 'withdraw_house_markdown', occurred_at: new Date().toISOString(), details: {}}); void qc.invalidateQueries({queryKey: ['house-source-metadata']});}}} disabled={role !== 'board'}>Stáhnout syntetickou citaci</button></div>
  </aside>;
}
export default function LocalFixtureApp() {
  return <QueryClientProvider client={client}><FixtureAuth><BrowserRouter><Controls/><Routes>
    <Route path="/" element={<Index/>}/><Route path="/zeptat-se" element={<AskHouse/>}/><Route path="/technicky-prehled" element={<TechnicalRegister/>}/><Route path="/technicky-prehled/:id" element={<TechnicalAssetDetail/>}/><Route path="/pozadavky" element={<Requests/>}/><Route path="/pozadavky/:id" element={<RequestDetail/>}/>
    <Route path="*" element={<main className="p-8"><h1 className="text-2xl font-bold">Tato část není součástí syntetické fixture</h1><Link to="/" className="text-primary underline">Zpět na úvod</Link></main>}/>
  </Routes></BrowserRouter></FixtureAuth></QueryClientProvider>;
}
