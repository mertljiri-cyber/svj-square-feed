import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/features/auth/AuthProvider";

function GoogleLogo() {
  return (
    <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"/>
      <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/>
      <path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/>
      <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/>
    </svg>
  );
}

// Token pozvánky je ve fragmentu URL (#pozvanka=…), aby se nedostal do serverových logů.
function readInviteToken(): string | null {
  const match = window.location.hash.match(/pozvanka=([^&]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export default function Login() {
  const navigate = useNavigate();
  const { session, refresh, activeMembership } = useAuth();
  const [mode, setMode] = useState<"in" | "up">("in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const invite = readInviteToken();

  useEffect(() => {
    if (!session) return;
    (async () => {
      if (invite) {
        const { error } = await supabase.rpc("accept_invitation", { p_token: invite });
        if (error) setMessage("Pozvánka je neplatná, použitá nebo prošlá.");
        else {
          setMessage("Pozvánka přijata. Členství čeká na schválení výborem.");
          window.history.replaceState(null, "", window.location.pathname);
        }
        await refresh();
      } else if (activeMembership) {
        navigate("/");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session]);

  async function signInWithGoogle() {
    setBusy(true);
    setMessage("");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/prihlaseni" + window.location.hash,
    });
    if (result.redirected) return;
    setBusy(false);
    if (result.error) setMessage("Přihlášení přes Google se nezdařilo.");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    const { error } = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/prihlaseni" + window.location.hash } });
    setBusy(false);
    if (error) setMessage(mode === "in" ? "Přihlášení se nezdařilo. Zkontrolujte údaje." : "Registraci se nepodařilo dokončit.");
    else if (mode === "up") setMessage("Zkontrolujte e-mail a potvrďte adresu. Poté se přihlaste.");
  }

  return (
    <Layout>
      <div className="page-container py-12 max-w-md">
        <h1 className="text-2xl font-bold mb-2">{mode === "in" ? "Přihlášení členů" : "Registrace člena"}</h1>
        <p className="text-sm text-muted-foreground mb-6">
          {invite ? "Máte pozvánku. Po přihlášení ji přijmeme; přístup k interním informacím získáte po schválení výborem."
            : "Interní obsah je dostupný jen členům SVJ se schváleným členstvím."}
        </p>
        {session ? (
          <p className="text-sm">Přihlášen. {message}</p>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#747775] bg-white px-3 py-2.5 text-sm font-medium text-[#1F1F1F] transition-colors hover:bg-[#F2F2F2] disabled:opacity-50"
            >
              <GoogleLogo />
              Pokračovat přes Google
            </button>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              nebo e-mailem
              <span className="h-px flex-1 bg-border" />
            </div>
          </div>
          <form onSubmit={submit} className="space-y-4">
            <label className="block text-sm font-medium">E-mail<Input className="mt-1" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="block text-sm font-medium">Heslo<Input className="mt-1" type="password" minLength={10} autoComplete={mode === "in" ? "current-password" : "new-password"} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
            <Button type="submit" disabled={busy}>{mode === "in" ? "Přihlásit se" : "Registrovat"}</Button>
            <button type="button" className="block text-sm text-primary underline" onClick={() => { setMode(mode === "in" ? "up" : "in"); setMessage(""); }}>
              {mode === "in" ? "Nemám účet" : "Už mám účet"}
            </button>
            {message && <p role="status" className="text-sm">{message}</p>}
          </form>
        )}
        <Link className="mt-8 inline-block text-sm text-muted-foreground underline" to="/">Zpět na úvod</Link>
      </div>
    </Layout>
  );
}
