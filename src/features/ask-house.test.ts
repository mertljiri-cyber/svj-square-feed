import { describe, expect, it, vi } from 'vitest';
import { answerQuestion, searchTerms, type Source } from '../../supabase/functions/ask-house/core';

const source: Source = { id:'a', document_id:'d', version_id:'v1', page:3, body:'Zvonky jsou položka plánu.', title:'Syntetický zápis' };
const setup = () => ({ search:vi.fn(async () => [source]), recheck:vi.fn(async () => [source]), generate:vi.fn(async () => ({kind:'answer', claims:[{text:'Zvonky jsou v plánu.', citations:[1]}]})) });
describe('ask house', () => {
  it('prioritizes topic words in Czech questions', () => expect(searchTerms('Co se schválilo ohledně zvonků?')[0]).toBe('zvonků'));
  it('returns server-owned source metadata, not model-supplied links', async () => {
    const deps=setup();
    expect(await answerQuestion('Co víme o zvoncích?', deps)).toMatchObject({kind:'answer',sources:[{document_id:'d',version_id:'v1',page:3,title:'Syntetický zápis'}]});
  });
  it('checks access to every input, including uncited ones, after generation', async () => {
    const deps=setup(); deps.search.mockResolvedValue([source,{...source,id:'b'}]);
    expect(await answerQuestion('Zvonky?', deps)).toEqual({kind:'unknown'});
  });
  it('never calls the model without a source and rejects invented citations', async () => {
    const deps=setup(); deps.search.mockResolvedValueOnce([]);
    expect(await answerQuestion('Zvonky?', deps)).toEqual({kind:'unknown'}); expect(deps.generate).not.toHaveBeenCalled();
    deps.generate.mockResolvedValueOnce({kind:'answer',claims:[{text:'Nedoloženo',citations:[2]}]});
    expect(await answerQuestion('Zvonky?', deps)).toEqual({kind:'unknown'});
  });
});
