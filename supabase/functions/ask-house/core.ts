export type Source = { id: string; note_key: string; revision: string; section: string; body: string; title: string; path?: string };
type Claim = { text: string; citations: number[] };
const UNKNOWN = { kind: 'unknown' } as const;
const STOP = new Set(['co','se','jak','jaky','jaka','je','jsou','bylo','byla','kdy','kde','kdo','o','v','ve','na','za','a','ohledne','ohlednem','schvalilo','schvalili','vime','stav','jaky','prosím']);
const stem = (word: string) => word.normalize('NFD').replace(/\p{M}/gu,'').replace(/(ich|ech|ami|emi|ove|ky|ku|ka|ek|e|y|u|i|a)$/u,'');
export function searchTerms(question: string) {
  return [...new Set((question.toLocaleLowerCase('cs').match(/[\p{L}\p{N}][\p{L}\p{N}-]*/gu) ?? []).filter(w => w.length > 2 && !STOP.has(w.normalize('NFD').replace(/\p{M}/gu,''))))].slice(0,4);
}
export function queryVariants(question: string) {
  return [...new Set(searchTerms(question).flatMap(t => [t, stem(t)]).filter(t=>t.length>=3))].slice(0,8);
}
export async function answerQuestion(question: string, deps: {search: (question:string)=>Promise<Source[]>; generate: (question:string,sources:Source[])=>Promise<unknown>; recheck: (ids:string[])=>Promise<Source[]>}) {
  const sources = (await deps.search(question)).slice(0,5);
  if (!sources.length) return UNKNOWN;
  const result = await deps.generate(question,sources);
  if (!result || typeof result !== 'object' || !('kind' in result) || result.kind !== 'answer' || !('claims' in result) || !Array.isArray(result.claims) || !result.claims.length || result.claims.length>8) return UNKNOWN;
  const claims: Claim[] = [];
  for (const c of result.claims) {
    if (!c || typeof c.text !== 'string' || !c.text.trim() || c.text.length>1200 || !Array.isArray(c.citations) || !c.citations.length || c.citations.length>5 || !c.citations.every((n: unknown)=> typeof n==='number' && Number.isInteger(n) && n>=1 && n<=sources.length)) return UNKNOWN;
    claims.push({text:c.text.trim(),citations:[...new Set<number>(c.citations)]});
  }
  const visible = new Map((await deps.recheck(sources.map(s=>s.id))).map(s=>[s.id,s]));
  if (sources.some(s=>{const current=visible.get(s.id);return !current || current.body!==s.body || current.revision!==s.revision || current.note_key!==s.note_key || current.section!==s.section || current.title!==s.title || current.path!==s.path;})) return UNKNOWN;
  return {kind:'answer' as const,claims,sources:sources.flatMap((s,i)=>claims.some(c=>c.citations.includes(i+1))?[{number:i+1,id:s.id,note_key:s.note_key,revision:s.revision,section:s.section,title:s.title,...(s.path ? {path:s.path} : {})}]:[])};
}
