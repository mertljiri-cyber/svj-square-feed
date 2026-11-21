import type { Source } from '../../supabase/functions/ask-house/core';

/** Fields of an answer citation that the server-side open must reproduce exactly. */
export type CitedSource = Pick<Source, 'id' | 'note_key' | 'revision' | 'section' | 'title' | 'path'>;

/**
 * Citation-open contract (POST ask-house {organization_id, citation_id} -> 200 {source: Source | null}).
 * A quote is shown only when the freshly re-verified source is the same passage of the same revision;
 * anything else (null, a changed revision, a different file) is treated as revoked.
 */
export function sameCitation(current: Source | null | undefined, cited: CitedSource): current is Source {
  return !!current && current.id === cited.id && current.revision === cited.revision && current.note_key === cited.note_key &&
    current.section === cited.section && current.title === cited.title && current.path === cited.path;
}
