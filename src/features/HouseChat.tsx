import { useRef, useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { answerQuestion, Source } from '../../supabase/functions/ask-house/core';

export type HouseAnswer = Awaited<ReturnType<typeof answerQuestion>>;
export type Citation = Extract<HouseAnswer, {kind: 'answer'}>['sources'][number];
export const EXAMPLE_QUESTIONS = ['Co se schválilo ohledně zvonků?', 'Jaký je plán oprav?', 'Jaká pravidla platí pro společné prostory?'];
export type ChatService = {
  ask: (question: string) => Promise<HouseAnswer>;
  read: (citation: Citation) => Promise<Source | null>;
};
export function HouseChat({ service }: {service: ChatService}) {
  const [input, setInput] = useState('');
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<HouseAnswer | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [citation, setCitation] = useState<Source | null>(null);
  const [citationStatus, setCitationStatus] = useState('');
  const inFlight = useRef(false);
  const citationRequest = useRef(0);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (inFlight.current || q.length < 3 || q.length > 400) return;
    inFlight.current = true;
    citationRequest.current++;
    setBusy(true); setError(''); setAnswer(null); setQuestion(q); setCitation(null); setCitationStatus('');
    try { setAnswer(await service.ask(q)); }
    catch (err) { setError(err instanceof Error && err.message === 'limit' ? 'Dosáhli jste limitu dotazů. Zkuste to později.' : 'Asistent je momentálně nedostupný.'); }
    finally { setBusy(false); inFlight.current = false; }
  }
  async function openCitation(source: Citation) {
    const request = ++citationRequest.current;
    setCitation(null); setCitationStatus('Ověřuji dostupnost citovaného úryvku…');
    try {
      const current = await service.read(source);
      if (request !== citationRequest.current) return;
      if (!current || current.id !== source.id || current.revision !== source.revision || current.note_key !== source.note_key || current.section !== source.section || current.title !== source.title) {
        setCitationStatus('Citace již není dostupná nebo nemáte oprávnění.'); return;
      }
      setCitation(current); setCitationStatus('');
    } catch { if (request === citationRequest.current) setCitationStatus('Citaci se nepodařilo ověřit. Zkuste ji otevřít znovu.'); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap gap-2" aria-label="Příklady dotazů">{EXAMPLE_QUESTIONS.map(q => <Button key={q} type="button" variant="outline" className="h-auto whitespace-normal text-left" disabled={busy} onClick={() => {setInput(q); inputRef.current?.focus();}}>{q}</Button>)}</div>
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="house-question" className="font-medium">Dotaz</label>
      <Textarea ref={inputRef} id="house-question" disabled={busy} maxLength={400} value={input} onChange={e => setInput(e.target.value)} placeholder={EXAMPLE_QUESTIONS[0]} />
      <Button disabled={busy || input.trim().length < 3 || input.trim().length > 400}>{error ? 'Zkusit znovu' : 'Zeptat se'}</Button>
    </form>
    {busy && <p role="status">Hledám v podkladech…</p>}
    {error && <p role="alert">{error}</p>}
    {answer && <section aria-label="Odpověď" className="space-y-3 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{question}</h2>
      {answer.kind === 'unknown' ? <p>V dostupných podkladech to není doložené.</p> : <ul className="space-y-3">{answer.claims.map((claim, i) => <li key={i}><p>{claim.text}</p>{answer.sources.filter(s => claim.citations.includes(s.number)).map(s => <button type="button" key={s.number} className="block py-2 text-left text-sm text-primary underline" onClick={() => void openCitation(s)}>Citace {s.number}: {s.title} · {s.section}</button>)}</li>)}</ul>}
    </section>}
    {citationStatus && <p role="status">{citationStatus}</p>}
    {citation && <section aria-label="Citovaný úryvek" className="space-y-2 rounded-xl border bg-card p-5">
      <h2 className="font-semibold">{citation.title} · {citation.section}</h2>
      <p className="break-all text-xs text-muted-foreground">Verze {citation.revision}</p>
      <blockquote className="whitespace-pre-wrap border-l-4 pl-3">{citation.body}</blockquote>
      <Button type="button" variant="outline" onClick={() => {citationRequest.current++; setCitation(null);}}>Zavřít úryvek</Button>
    </section>}
  </div>;
}
