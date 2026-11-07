import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/features/auth/AuthProvider";

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
