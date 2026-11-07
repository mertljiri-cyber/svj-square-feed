import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Grant = { scope: string; permission: string };
export type Membership = {
  membership_id: string;
  organization_id: string;
  organization_name: string;
  status: "invited" | "active" | "suspended" | "ended";
  row_version: number;
  roles: string[];
  grants: Grant[];
};
export type MyContext = { user_id: string; memberships: Membership[] };

type AuthState = {
  loading: boolean;
  session: Session | null;
  context: MyContext | null;
  /** Aktivní členství v prvním SVJ; interní obsah se povoluje jen při status = active. */
  activeMembership: Membership | null;
  isBoard: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [context, setContext] = useState<MyContext | null>(null);

  const load = useCallback(async (current: Session | null) => {
    if (!current) {
      setContext(null);
      return;
    }
    const { data, error } = await supabase.rpc("my_context");
    // Chyba načtení kontextu nepovolí interní přístup; UI zůstane v režimu veřejnosti.
    setContext(error ? null : (data as unknown as MyContext));
  }, []);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await load(data.session);
      if (active) setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void load(next);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [load]);

  const activeMembership = context?.memberships.find((m) => m.status === "active") ?? null;
  const isBoard = !!activeMembership?.roles.includes("board");

  const value: AuthState = {
    loading,
    session,
    context,
    activeMembership,
    isBoard,
    refresh: () => load(session),
    signOut: async () => {
      await supabase.auth.signOut();
      setContext(null);
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth musí být použit uvnitř AuthProvider");
  return ctx;
}
