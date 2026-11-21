import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, FileText, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { Source } from '../../supabase/functions/ask-house/core';
import type { ChatService, Citation, HouseAnswer } from './houseChatService';
import { sameCitation } from './citationContract';

export type { ChatService } from './houseChatService';
const EXAMPLE_QUESTIONS = ['Co se schválilo ohledně zvonků?', 'Jaký je plán oprav?', 'Jaká pravidla platí pro společné prostory?'];
type Turn = {question: string; answer: HouseAnswer | null};
type CitationView = {turn: number; status: string; source?: Source};

export function HouseChat({service, compact = false, visible = true}: {service: ChatService; compact?: boolean; visible?: boolean}) {
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [citation, setCitation] = useState<CitationView | null>(null);
  const inFlight = useRef(false);
  const citationRequest = useRef(0);
  const citationTrigger = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);
  const citationRef = useRef<HTMLDivElement>(null);
  const id = useId();
  const inputLength = input.trim().length;

  useEffect(() => {
    if (!visible) {
      citationRequest.current++;
      setCitation(null);
      return;
    }
    const transcript = transcriptRef.current;
    if (compact && transcript) transcript.scrollTop = transcript.scrollHeight;
  }, [busy, compact, turns, visible]);

  useEffect(() => {
    if (visible && citation?.source) citationRef.current?.scrollIntoView({block: 'nearest'});
  }, [citation, visible]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const question = input.trim();
    if (inFlight.current || question.length < 3 || question.length > 400) return;
    inFlight.current = true;
    citationRequest.current++;
    setCitation(null);
    setBusy(true);
    setError('');
    setTurns(prev => [...(compact ? prev.filter(turn => turn.answer) : []), {question, answer: null}]);
    try {
      const answer = await service.ask(question);
      setTurns(prev => [...prev.slice(0, -1), {question, answer}]);
      if (compact) setInput('');
    } catch (err) {
      setError(err instanceof Error && err.message === 'limit' ? 'Dosáhli jste limitu dotazů. Zkuste to později.' : 'Asistent je momentálně nedostupný.');
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function openCitation(turn: number, cited: Citation, button: HTMLButtonElement) {
    const request = ++citationRequest.current;
    citationTrigger.current = button;
    setCitation({turn, status: 'Ověřuji dostupnost citovaného úryvku…'});
    try {
      const current = await service.read(cited);
      if (request !== citationRequest.current) return;
      if (!sameCitation(current, cited)) {
        setCitation({turn, status: 'Citace již není dostupná nebo nemáte oprávnění.'});
        return;
      }
      setCitation({turn, source: current, status: 'Citovaný úryvek je dostupný.'});
    } catch {
      if (request === citationRequest.current) setCitation({turn, status: 'Citaci se nepodařilo ověřit. Zkuste ji otevřít znovu.'});
    }
  }

  return <div className={compact ? 'flex min-h-0 flex-1 flex-col' : 'space-y-5'}>
    <div ref={transcriptRef} className={compact ? 'min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5' : 'space-y-4'}>
      {turns.length === 0 && <div className="space-y-3">
        <div className="rounded-2xl rounded-tl-sm border bg-card p-4 text-sm leading-relaxed">
          <p className="mb-1 font-semibold">Co vás zajímá o vašem domě?</p>
          <p>Zeptat se můžete na zápisy, pravidla nebo opravy. Odpovědi si můžete ověřit v citovaných podkladech.</p>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Příklady dotazů">{EXAMPLE_QUESTIONS.map(question =>
          <Button key={question} type="button" variant="outline" className="h-auto min-h-10 justify-start gap-2 whitespace-normal rounded-xl px-3 py-2 text-left text-primary"
            onClick={() => {setInput(question); inputRef.current?.focus();}}>
            <ArrowUpRight className="h-4 w-4 shrink-0" aria-hidden="true"/>{question}
          </Button>)}
        </div>
      </div>}
      <div role="log" aria-label="Konverzace" className="space-y-4">
        {turns.map(({question, answer}, turn) => <div key={turn} className="space-y-3">
          <div className="ml-auto w-fit max-w-[90%] whitespace-pre-wrap break-words rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-sm text-primary-foreground">
            <span className="sr-only">Vy: </span>{question}
          </div>
          {answer && <section aria-label="Odpověď" className="space-y-3 break-words rounded-2xl rounded-tl-sm border bg-card p-4 text-sm leading-relaxed">
            {answer.kind === 'unknown' ? <p>V dostupných podkladech to není doložené.</p> : <ul className="space-y-3">{answer.claims.map((claim, i) => <li key={i}>
              <p className="whitespace-pre-wrap">{claim.text}</p>
              <div className="mt-2 flex flex-wrap gap-2">{answer.sources.filter(s => claim.citations.includes(s.number)).map(source =>
                <button type="button" key={source.number} className="inline-flex min-h-10 max-w-full items-center gap-2 rounded-lg bg-primary/10 px-2.5 py-1.5 text-left text-xs font-medium text-primary hover:underline focus-visible:outline-primary"
                  onClick={event => void openCitation(turn, source, event.currentTarget)}>
                  <FileText className="h-4 w-4 shrink-0" aria-hidden="true"/><span className="min-w-0 break-words">Citace {source.number}: {source.title} · {source.section}</span>
                </button>)}
              </div>
            </li>)}</ul>}
          </section>}
          {citation?.turn === turn && <div ref={citationRef} className="space-y-2">
            <p role="status" className={citation.source ? 'sr-only' : 'text-sm'}>{citation.status}</p>
            {citation.source && visible && <section aria-label="Citovaný úryvek" className="space-y-2 break-words rounded-xl border bg-card p-4 text-sm">
              <h3 className="font-semibold">{citation.source.title} · {citation.source.section}</h3>
              {citation.source.path && <p className="break-all text-xs text-foreground/75">Soubor: {citation.source.path}</p>}
              <p className="break-all text-xs text-foreground/75">Verze {citation.source.revision}</p>
              <blockquote className="whitespace-pre-wrap border-l-2 border-primary/40 pl-3 leading-relaxed">{citation.source.body}</blockquote>
              <Button type="button" variant="outline" onClick={() => {citationRequest.current++; setCitation(null); citationTrigger.current?.focus();}}>Zavřít úryvek</Button>
            </section>}
          </div>}
        </div>)}
      </div>
      {busy && <p role="status" className="text-sm text-foreground/75">Hledám v podkladech…</p>}
      {error && <p role="alert" className="rounded-xl border border-destructive/40 bg-card p-3 text-sm">{error}</p>}
    </div>
    <form onSubmit={submit} className={compact ? 'shrink-0 space-y-2 border-t bg-card px-4 py-3 sm:px-5' : 'space-y-2 rounded-xl border bg-card p-4'}>
      <label htmlFor={id} className="block text-sm font-medium">Váš dotaz</label>
      <div className="flex flex-wrap items-end justify-end gap-2">
        <Textarea ref={inputRef} id={id} readOnly={busy} maxLength={400} value={input} onChange={event => setInput(event.target.value)}
          placeholder="Napište svůj dotaz…" aria-describedby={`${id}-hint`} rows={2} className="min-h-12 min-w-0 flex-1 resize-none rounded-xl bg-background text-base"/>
        <Button type="submit" disabled={busy || inputLength < 3 || inputLength > 400} className="h-11 gap-2 rounded-xl">
          <Send className="h-4 w-4" aria-hidden="true"/>{error ? 'Zkusit znovu' : 'Zeptat se'}
        </Button>
      </div>
      <p id={`${id}-hint`} className="text-xs text-foreground/75">Nevkládejte osobní údaje. Nejvýše 400 znaků.</p>
    </form>
  </div>;
}
