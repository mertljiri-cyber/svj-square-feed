import { useEffect, useId, useRef, useState } from 'react';
import { ArrowUpRight, MessageCircle, X } from 'lucide-react';
import { Link, matchPath, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { HouseChat } from './HouseChat';
import { createHouseChatService, useHouseChatScope } from './houseChatService';
import './floatingHouseChat.css';

export function FloatingHouseChat() {
  const {pathname} = useLocation();
  const scope = useHouseChatScope();
  if (import.meta.env.VITE_SVJ_ASK_ENABLED === 'false' || !scope || matchPath('/zeptat-se', pathname)) return null;
  return <ChatDialog key={scope.key} organizationId={scope.organizationId}/>;
}

function ChatDialog({organizationId}: {organizationId: string}) {
  const [open, setOpen] = useState(false);
  const [service] = useState(() => createHouseChatService(organizationId));
  const dialog = useRef<HTMLDialogElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const id = useId();

  useEffect(() => {
    const viewport = window.visualViewport;
    const panel = dialog.current;
    if (!open || !viewport || !panel) return;
    // Keep the composer above the on-screen keyboard without sizing to the layout viewport.
    const resize = () => {
      panel.style.setProperty('--chat-viewport-height', `${viewport.height}px`);
      panel.style.setProperty('--chat-viewport-bottom', `${Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)}px`);
    };
    resize();
    viewport.addEventListener('resize', resize);
    viewport.addEventListener('scroll', resize);
    return () => {
      viewport.removeEventListener('resize', resize);
      viewport.removeEventListener('scroll', resize);
    };
  }, [open]);

  return <>
    <Button ref={launcher} type="button" className="house-chat-launcher h-14 gap-2 rounded-full px-4 text-base shadow-lg sm:px-5"
      aria-label="Otevřít chat o domě" aria-haspopup="dialog" aria-controls={id} aria-expanded={open}
      onClick={() => {dialog.current?.showModal(); setOpen(true); closeButton.current?.focus();}}>
      <MessageCircle className="h-6 w-6" aria-hidden="true"/><span className="hidden sm:inline">Zeptat se na dům</span>
    </Button>
    <dialog ref={dialog} id={id} className="house-chat-dialog border bg-background text-foreground shadow-2xl"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}
      onClose={() => {setOpen(false); launcher.current?.focus();}}>
      <header className="flex shrink-0 items-start gap-3 border-b bg-card px-4 py-3 sm:px-5 sm:py-4">
        <span className="rounded-xl bg-primary/10 p-2 text-primary"><MessageCircle className="h-5 w-5" aria-hidden="true"/></span>
        <div className="min-w-0 flex-1">
          <h2 id={`${id}-title`} className="text-lg font-bold">Asistent domu</h2>
          <p id={`${id}-description`} className="text-sm text-foreground/75">Zápisy, pravidla a opravy SVJ</p>
        </div>
        <Button ref={closeButton} type="button" variant="ghost" size="icon" className="h-11 w-11 shrink-0" aria-label="Zavřít chat" onClick={() => dialog.current?.close()}>
          <X className="h-5 w-5" aria-hidden="true"/>
        </Button>
      </header>
      <HouseChat compact service={service} visible={open}/>
      <footer className="shrink-0 border-t bg-card px-4 sm:px-5">
        <Link to="/zeptat-se" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-primary">
          Otevřít celou stránku <ArrowUpRight className="h-4 w-4" aria-hidden="true"/>
        </Link>
      </footer>
    </dialog>
  </>;
}
