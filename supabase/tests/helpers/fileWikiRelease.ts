// Test-side twin of scripts/wiki-release-import.py: builds release-relative objects (manifest, notes, index).
// Synthetic data only.
import { createHash } from 'node:crypto';
import { indexKey, indexShard, indexWords, noteObjectPath } from '../../functions/ask-house/file-wiki';

const bytes = (s: string) => new TextEncoder().encode(s);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
export type Shard = { version: number; shard: number; words: [string, number[]][] };

export function buildRelease(notes: Record<string, string>, opts: { version?: 1 | 2; shards?: number; tamper?: (shards: Shard[]) => void } = {}) {
  const version = opts.version ?? 2;
  const sorted = Object.entries(notes).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const objects = new Map<string, Uint8Array>(sorted.map(([p, t]) => [noteObjectPath(p), bytes(t)]));
  const files = sorted.map(([path, text]) => ({ path, sha256: sha(bytes(text)), bytes: bytes(text).length }));
  let index: { shards: { sha256: string; bytes: number }[] } | undefined;
  if (version === 2) {
    const n = opts.shards ?? 8;
    const postings = new Map<string, number[]>();
    sorted.forEach(([path, text], i) => { for (const w of indexWords(`${text}\n${path}`)) postings.set(w, [...(postings.get(w) ?? []), i]); });
    const shards: Shard[] = Array.from({ length: n }, (_, shard) => ({ version: 2, shard, words: [] }));
    for (const [w, list] of postings) shards[indexShard(w, n)].words.push([w, list]);
    opts.tamper?.(shards);
    index = { shards: shards.map((s, i) => { const b = bytes(JSON.stringify(s)); objects.set(indexKey(i), b); return { sha256: sha(b), bytes: b.length }; }) };
  }
  const manifest = bytes(JSON.stringify({ version, files, ...(index ? { index } : {}) }));
  objects.set('manifest.json', manifest);
  return { objects, manifest_sha256: sha(manifest) };
}

/** >160 synthetic notes. The answer lives in a late file and links to a note without query words. */
export const LATE = 'Zápisy/Výtah 2026.md';
export const LARGE_QUESTION = 'Kdy proběhne výměna lan výtahu?';
export function largeVault(count = 230) {
  const notes: Record<string, string> = {};
  for (let i = 0; i < count; i++) {
    const n = String(i).padStart(3, '0');
    notes[`Archiv/Poznámka ${n}.md`] = `# Poznámka ${n}\nÚklid schodiště proběhl podle plánu ${n}.` + (i % 10 === 0 ? '\nVýtah byl bez závad.' : '');
  }
  notes['Zápisy/Rozpočet.md'] = '# Rozpočet\n## Úvod\nRozpočet schválila schůze.\n## Částka\nNa opravy je vyčleněno 350 000 Kč.';
  notes[LATE] = '# Výtah\n## Stav\nVýměna lan výtahu proběhne v březnu. Viz [rozpočet](Rozpo%C4%8Det.md#%C4%8C%C3%A1stka) a [[Archiv/Poznámka 042]].';
  return notes;
}
