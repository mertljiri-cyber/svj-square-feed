import { HouseMarkdownImport } from '@/features/HouseMarkdownImport';
import { Layout } from '@/components/layout/Layout';
import { HouseChat, type ChatService } from '@/features/HouseChat';
import { RequireMember } from '@/features/auth/RequireMember';
import { useAuth } from '@/features/auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import type { answerQuestion } from '../../supabase/functions/ask-house/core';

type Answer = Awaited<ReturnType<typeof answerQuestion>>;

function Chat({ org, isBoard }: {org: string; isBoard:boolean}) {
  const service: ChatService = {
    ask: async question => {
      const result = await supabase.functions.invoke<Answer>('ask-house', {body: {organization_id: org, question}});
      if (result.error || !result.data) throw new Error(result.error?.context?.status === 429 ? 'limit' : 'unavailable');
      return result.data;
    },
    read: async source => {
      const {data, error} = await supabase.rpc('read_house_markdown', {p_org: org, p_terms: [], p_ids: [source.id]});
      if (error) throw error;
      const rows = data as unknown as import('../../supabase/functions/ask-house/core').Source[];
      return rows?.find(row => row.id === source.id) ?? null;
    },
  };
  return <Layout><div className="page-container max-w-3xl space-y-6 py-8">
    <div><h1 className="text-3xl font-bold">Zeptat se na dům</h1><p className="mt-2 text-muted-foreground">Ptejte se česky na zápisy, pravidla a opravy. Odpovědi ověřujte v citovaných podkladech. Nevkládejte osobní údaje.</p></div>
    {isBoard && <HouseMarkdownImport org={org}/> }
    <HouseChat service={service}/>
  </div></Layout>;
}
function MemberChat(){const {session,activeMembership,isBoard}=useAuth();return <Chat key={`${session!.user.id}:${activeMembership!.organization_id}`} org={activeMembership!.organization_id} isBoard={isBoard}/>;}
export default function AskHouse(){return <RequireMember><MemberChat/></RequireMember>;}
