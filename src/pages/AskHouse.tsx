import { useState, type FormEvent } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { RequireMember } from '@/features/auth/RequireMember';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import type { answerQuestion } from '../../supabase/functions/ask-house/core';

type Answer = Awaited<ReturnType<typeof answerQuestion>>;

function Chat({ org }: {org: string}) {
  const [input,setInput]=useState('');
  const [question,setQuestion]=useState('');
  const [answer,setAnswer]=useState<Answer|null>(null);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent) {
    e.preventDefault(); const q=input.trim(); if(busy || q.length<3 || q.length>400)return;
    setBusy(true);setError('');setAnswer(null);setQuestion(q);
    try {
      const result=await supabase.functions.invoke<Answer>('ask-house',{body:{organization_id:org,question:q}});
      if(result.error || !result.data) {setError(result.error?.context?.status===429?'Dosáhli jste limitu dotazů. Zkuste to později.':'Asistent je momentálně nedostupný.');return;}
      setAnswer(result.data);
    } catch {setError('Asistent je momentálně nedostupný.');} finally {setBusy(false);}
  }
  async function openPdf(version:string,page:number) {
    setError('');
    try {
      const a=await supabase.rpc('authorize_download',{p_version_id:version});
      if(a.error || !a.data) throw new Error('source');
      const {object_key}=a.data as {object_key:string};
      const s=await supabase.storage.from('documents').createSignedUrl(object_key,60);
      if(s.error || !s.data) throw new Error('source');
      window.location.assign(`${s.data.signedUrl}#page=${page}`);
    } catch {setError('Podklad už není dostupný nebo k němu nemáte přístup.');}
  }
  return <Layout><div className="page-container max-w-3xl space-y-6 py-8">
    <div><h1 className="text-3xl font-bold">Zeptat se na dům</h1><p className="mt-2 text-muted-foreground">Ptejte se česky na zápisy, pravidla a opravy. Odpovědi ověřujte v citovaných podkladech. Nevkládejte osobní údaje.</p></div>
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="house-question" className="font-medium">Dotaz</label>
      <Textarea id="house-question" maxLength={400} value={input} onChange={e=>setInput(e.target.value)} placeholder="Co se schválilo ohledně zvonků?" />
      <Button disabled={busy || input.trim().length<3}>Zeptat se</Button>
    </form>
    {busy && <p role="status">Hledám v podkladech…</p>}
    {error && <p role="alert">{error}</p>}
    {answer && <section aria-label="Odpověď" className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{question}</h2>
      {answer.kind==='unknown' ? <p>V dostupných podkladech to není doložené.</p> : <ul className="space-y-3">{answer.claims.map((c,i)=><li key={i}><p>{c.text}</p>{answer.sources.filter(s=>c.citations.includes(s.number)).map(s=><Button type="button" key={s.number} variant="link" className="h-auto whitespace-normal px-0 text-left" onClick={()=>void openPdf(s.version_id,s.page)}>{s.title} · strana {s.page}</Button>)}</li>)}</ul>}
    </section>}
  </div></Layout>;
}
function MemberChat(){const {session,activeMembership}=useAuth();return <Chat key={`${session!.user.id}:${activeMembership!.organization_id}`} org={activeMembership!.organization_id}/>;}
export default function AskHouse(){return <RequireMember><MemberChat/></RequireMember>;}
