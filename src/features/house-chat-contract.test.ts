// Contract test: the real frontend service + citation check against the real ask-house handler.
// supabase.functions.invoke is replaced by a shim with supabase-js semantics (non-2xx -> error.context = Response).
import { webcrypto } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createAskHouseHandler } from '../../supabase/functions/ask-house/handler';
import { fileWikiWorld, ORG_A, ORG_B, post, RELEASE_1, RELEASE_2 } from '../../supabase/tests/helpers/fileWikiWorld';
import { sameCitation } from './citationContract';
import { createHouseChatService } from './houseChatService'; // loaded after the hoisted vi.mock calls

vi.stubGlobal('crypto', webcrypto);
const session = vi.hoisted(() => ({token: 'owner-a', handle: null as null | ((req: Request) => Promise<Response>)}));
vi.mock('@/features/auth/AuthProvider', () => ({useAuth: () => ({})}));
vi.mock('@/integrations/supabase/client', () => ({supabase: {functions: {invoke: async (_name: string, {body}: {body: unknown}) => {
  const res = await session.handle!(post(body, session.token));
  return res.ok ? {data: await res.json(), error: null} : {data: null, error: {name: 'FunctionsHttpError', context: res}};
}}}}));

let w: ReturnType<typeof fileWikiWorld>;
beforeEach(() => {
  w = fileWikiWorld();
  w.activate(ORG_A, w.publish(ORG_A, RELEASE_1, {
    'Rada/Zvonky.md': '# Zvonky\n## Usnesení\nVýbor schválil výměnu zvonků, viz [[Rozpočet]].',
    'Rada/Rozpočet.md': '# Rozpočet\nNa zvonky je vyčleněno 40 000 Kč.',
  }));
  session.token = 'owner-a';
  session.handle = createAskHouseHandler({enabled: true, connect: w.connect,
    generate: async (_q, sources) => ({kind: 'answer', claims: [{text: 'Výměna je schválená.', citations: sources.map((_, i) => i + 1)}]})});
});

async function citations() {
  const answer = await createHouseChatService(ORG_A).ask('Co se schválilo ohledně zvonků?');
  if (answer.kind !== 'answer') throw new Error('expected an answer');
  return answer.sources;
}

it('opens exactly the cited passage of the active release', async () => {
  const sources = await citations();
  expect(sources.map(s => s.path)).toEqual(['Rada/Zvonky.md', 'Rada/Rozpočet.md']);
  for (const cited of sources) {
    const current = await createHouseChatService(ORG_A).read(cited);
    expect(sameCitation(current, cited)).toBe(true);
    expect(current?.body).toMatch(/zvonk/i);
  }
});

it('shows a revoked or foreign citation as unavailable, never as a quote', async () => {
  const [cited] = await citations();
  const service = createHouseChatService(ORG_A);
  // Same release ID can never be re-activated; a replacement release invalidates older citations.
  w.activate(ORG_A, w.publish(ORG_A, RELEASE_2, {'Rada/Zvonky.md': '# Zvonky\n## Usnesení\nVýbor schválil výměnu zvonků, viz [[Rozpočet]].'}));
  expect(await service.read(cited)).toBeNull();
  w.tombstone(ORG_A);
  expect(await service.read(cited)).toBeNull();
  session.token = 'owner-b';
  expect(await service.read(cited)).toBeNull(); // 403 -> null
  expect(sameCitation(await createHouseChatService(ORG_B).read(cited), cited)).toBe(false);
  // A changed passage (same ID, other text/revision) fails the client-side comparison too.
  expect(sameCitation({...cited, body: 'x', revision: 'f'.repeat(64)}, cited)).toBe(false);
});

it('surfaces backend failures as errors instead of an empty or stale quote', async () => {
  const [cited] = await citations();
  w.failures.add('get_house_file_release');
  await expect(createHouseChatService(ORG_A).read(cited)).rejects.toBeTruthy();
  await expect(createHouseChatService(ORG_A).ask('Co se schválilo ohledně zvonků?')).rejects.toThrow('unavailable');
});
