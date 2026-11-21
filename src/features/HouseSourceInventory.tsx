import { useQuery } from '@tanstack/react-query';
import { useAuth } from './auth/AuthProvider';
import { supabase } from '@/integrations/supabase/client';
import { sourceMetadata, type SourceEvent } from './sourceMetadata';
import { Button } from '@/components/ui/button';

export function HouseSourceInventory({org}: {org: string}) {
  const {session, isBoard, activeMembership} = useAuth();
  const allowed = isBoard && activeMembership?.organization_id === org;
  const {data, error, isLoading, isFetching, refetch} = useQuery({
    queryKey: ['house-source-metadata', session?.user.id, org],
    enabled: allowed,
    queryFn: async () => {
      const events: SourceEvent[] = [];
      // Fixed upper ID provides a consistent snapshot while a new event is appended.
      let before: number | null = null;
      for (let page = 0; page < 50; page++) {
        let query = supabase.from('audit_events').select('id,action,object_id,occurred_at,details').eq('organization_id', org).eq('object_type', 'house_markdown').order('id', {ascending: false}).limit(200);
        if (before !== null) query = query.lt('id', before);
        const {data: rows, error} = await query;
        if (error) throw error;
        events.push(...rows);
        if (rows.length < 200) return sourceMetadata(events);
        before = rows[rows.length - 1].id;
      }
      throw new Error('incomplete');
    },
  });
  if (!allowed) return null;
  return <section aria-label="Aktivní zdroje" className="my-4 space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Poznámky a verze</h2><Button type="button" variant="outline" disabled={isFetching} onClick={() => void refetch()}>Obnovit přehled</Button></div>
    <p className="text-xs text-muted-foreground">Stav podle posledního úspěšného auditního záznamu v tomto SVJ. Obsah poznámek se zde nenačítá.</p>
    {isLoading && <p role="status">Načítání metadat…</p>}
    {error && <p role="alert">Úplný přehled zdrojů se nepodařilo načíst. Obnovte přehled nebo zkontrolujte audit.</p>}
    {!isLoading && !error && data?.length === 0 && <p>Žádné zveřejněné poznámky v dostupném auditu.</p>}
    {!error && data?.map(note => <article key={note.key} className="rounded border p-3 text-sm"><h3 className="font-medium">{note.key} · {note.active ? 'aktivní' : 'stažená'}</h3><p className="break-all">Verze: {note.revision ?? 'nedoložena'}</p><p>Poslední změna: <time dateTime={note.changedAt}>{new Date(note.changedAt).toLocaleString('cs')}</time></p></article>)}
  </section>;
}
