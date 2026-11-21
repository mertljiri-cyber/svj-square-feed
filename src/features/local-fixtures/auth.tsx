import { createContext, useContext, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { fixture, user } from './client';
const Context = createContext({role: 'owner', setRole: (_role: string) => {}});
export function FixtureAuth({children}: {children: ReactNode}) {
  const [role, update] = useState('owner');
  return <Context.Provider value={{role, setRole: role => {fixture.role = role; update(role);}}}>{children}</Context.Provider>;
}
export function useFixtureRole() {return useContext(Context);}
export function useAuth() {
  const {role} = useContext(Context);
  const member = {membership_id: 'synthetic-membership', organization_id: 'synthetic-org', organization_name: 'Modelový dům', status: 'active' as const, row_version: 1, roles: [role === 'board' ? 'board' : 'owner'], grants: []};
  return {loading: false, session: {user: {id: user()}} as Session, context: {user_id: user(), memberships: [member]}, activeMembership: member, isBoard: role === 'board', refresh: async () => {}, signOut: async () => {}};
}
