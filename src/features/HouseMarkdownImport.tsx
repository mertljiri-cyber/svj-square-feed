import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { HouseSourceInventory } from './HouseSourceInventory';
import { useQueryClient } from '@tanstack/react-query';

export function HouseMarkdownImport({ org }: {org: string}) {
  const queryClient = useQueryClient();
  const [note,setNote]=useState<{key:string; body:string}|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [status,setStatus]=useState('');
  const [busy,setBusy]=useState(false);
  return <details className="space-y-3 rounded-xl border p-4">
    <summary className="cursor-pointer font-medium">Správa zdrojů wiki</summary>
    <HouseSourceInventory org={org}/>
    <p className="text-sm text-muted-foreground">Vyberte schválenou poznámku .md určenou všem aktivním členům SVJ. Nevkládejte soukromou korespondenci, osobní údaje ani interní odkazy. Výňatky může zpracovat poskytovatel AI.</p>
    <label className="block">Poznámka .md <input type="file" accept=".md" disabled={busy} onChange={async e=>{
      const f=e.target.files?.[0];setConfirmed(false);setNote(null);setStatus('');
      if(!f)return;
      const key=f.name.replace(/\.md$/i,'');
      if(!/\.md$/i.test(f.name)||!/^[a-z0-9-]{1,80}$/.test(key)||!f.size||f.size>60000){setStatus('Použijte neprázdný soubor .md do 60 kB s názvem bez mezer a diakritiky.');return;}
      setBusy(true); try {setNote({key,body:await f.text()});} catch {setStatus('Soubor nelze přečíst.');} finally {setBusy(false);}
    }}/></label>
    {note && <><pre tabIndex={0} className="max-h-56 overflow-auto whitespace-pre-wrap rounded border p-2 text-sm">{note.body}</pre>
      <label className="flex items-start gap-2"><input type="checkbox" checked={confirmed} onChange={e=>setConfirmed(e.target.checked)}/>Schvaluji tento obsah pro všechny aktivní členy SVJ.</label>
      <Button disabled={!confirmed||busy} onClick={async()=>{
        const title=note.body.match(/^#\s+(.{1,160})$/m)?.[1]?.trim()||note.key;
        setBusy(true);setStatus('');
        try {
          const {error}=await supabase.rpc('publish_house_markdown',{p_org:org,p_key:note.key,p_title:title,p_markdown:note.body});
          if(error)throw error;
          setStatus('Poznámka je aktivní pro dotazy.');setConfirmed(false);
          void queryClient.invalidateQueries({queryKey: ['house-source-metadata']});
        } catch {setStatus('Poznámku se nepodařilo zveřejnit.');} finally {setBusy(false);}
      }}>Schválit poznámku pro chat</Button>
      <Button variant="outline" className="ml-2" disabled={busy} onClick={async()=>{
        setBusy(true);setStatus('');
        try {const {error}=await supabase.rpc('withdraw_house_markdown',{p_org:org,p_key:note.key});if(error)throw error;setStatus('Poznámka je stažená z chatu.');setConfirmed(false);void queryClient.invalidateQueries({queryKey: ['house-source-metadata']});} catch {setStatus('Poznámku se nepodařilo stáhnout.');} finally {setBusy(false);}
      }}>Stáhnout tuto poznámku z chatu</Button>
    </>}
    {status&&<p role="status">{status}</p>}
  </details>;
}
