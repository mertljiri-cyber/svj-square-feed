import { HouseMarkdownImport } from '@/features/HouseMarkdownImport';
import { Layout } from '@/components/layout/Layout';
import { HouseChat } from '@/features/HouseChat';
import { RequireMember } from '@/features/auth/RequireMember';
import { createHouseChatService, useHouseChatScope } from '@/features/houseChatService';

function MemberChat() {
  const scope = useHouseChatScope();
  if (!scope) return <Layout><p className="page-container" role="status">Načítání členství…</p></Layout>;
  return <Layout><div className="page-container max-w-3xl space-y-6 py-8" key={scope.key}>
    <h1 className="text-3xl font-bold">Zeptat se na dům</h1>
    {scope.isBoard && <HouseMarkdownImport org={scope.organizationId}/>}
    <HouseChat service={createHouseChatService(scope.organizationId)}/>
  </div></Layout>;
}

export default function AskHouse() {
  return <RequireMember><MemberChat/></RequireMember>;
}
