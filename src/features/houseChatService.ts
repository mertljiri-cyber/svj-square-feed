import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import type { answerQuestion, Source } from '../../supabase/functions/ask-house/core';

export type HouseAnswer = Awaited<ReturnType<typeof answerQuestion>>;
export type Citation = Extract<HouseAnswer, {kind: 'answer'}>['sources'][number];
export type ChatService = {
  ask: (question: string) => Promise<HouseAnswer>;
  read: (citation: Citation) => Promise<Source | null>;
};

export function useHouseChatScope() {
  const {loading, session, context, activeMembership, isBoard} = useAuth();
  const userId = session?.user.id;
  if (loading || !userId || context?.user_id !== userId || !activeMembership) return null;
  const organizationId = activeMembership.organization_id;
  return {key: `${userId}:${organizationId}`, organizationId, isBoard};
}

export function createHouseChatService(organizationId: string): ChatService {
  return {
    async ask(question) {
      const {data, error} = await supabase.functions.invoke<HouseAnswer>('ask-house', {
        body: {organization_id: organizationId, question},
      });
      if (error || !data) throw new Error(error?.context?.status === 429 ? 'limit' : 'unavailable');
      return data;
    },
    async read(citation) {
      const {data, error} = await supabase.functions.invoke<{source: Source | null}>('ask-house', {
        body: {organization_id: organizationId, citation_id: citation.id},
      });
      if (error) {
        if (error.context?.status === 403) return null;
        throw error;
      }
      // Contract: 200 {source: Source | null}; 403 = no access. Anything else is an error, never a quote.
      if (!data || typeof data !== 'object' || !('source' in data)) throw new Error('unavailable');
      return data.source ?? null;
    },
  };
}
