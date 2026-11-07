import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useAuth } from "./AuthProvider";

/** Obsah jen pro aktivní členy. Nepřihlášený nebo nepotvrzený uživatel uvidí vysvětlení, ne data. */
export function RequireMember({ children, boardOnly = false }: { children: ReactNode; boardOnly?: boolean }) {
  const { loading, session, activeMembership, isBoard } = useAuth();
  if (loading) return <Layout><div className="page-container py-12 text-muted-foreground">Načítání…</div></Layout>;
  if (!session) {
    return (
      <Layout>
        <div className="page-container py-12 max-w-xl">
          <h1 className="text-2xl font-bold mb-3">Přihlášení vyžadováno</h1>
          <p className="text-muted-foreground mb-6">Tato část je určena pouze členům SVJ.</p>
          <Link className="text-primary underline" to="/prihlaseni">Přihlásit se</Link>
        </div>
      </Layout>
    );
  }
  if (!activeMembership) {
    return (
      <Layout>
        <div className="page-container py-12 max-w-xl">
          <h1 className="text-2xl font-bold mb-3">Členství čeká na schválení</h1>
          <p className="text-muted-foreground">Po schválení výborem získáte přístup k interním informacím. Do té doby zůstává obsah skrytý.</p>
        </div>
      </Layout>
    );
  }
  if (boardOnly && !isBoard) {
    return (
      <Layout>
        <div className="page-container py-12 max-w-xl">
          <h1 className="text-2xl font-bold mb-3">Pouze pro výbor</h1>
        </div>
      </Layout>
    );
  }
  return <>{children}</>;
}
