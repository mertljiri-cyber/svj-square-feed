export type SourceEvent = {id: number; action: string; object_id: string | null; occurred_at: string; details: unknown};
export type SourceMetadata = {key: string; active: boolean; revision: string | null; changedAt: string};
// Audit contains only metadata. Current state is the newest successful publish/withdraw.
export function sourceMetadata(events: SourceEvent[]): SourceMetadata[] {
  const notes = new Map<string, SourceMetadata>();
  for (const event of [...events].sort((a, b) => b.id - a.id)) {
    if (!event.object_id || !/^[a-z0-9-]{1,80}$/.test(event.object_id) || !['publish_house_markdown', 'withdraw_house_markdown'].includes(event.action)) continue;
    const revision = event.details && typeof event.details === 'object' && 'revision' in event.details && typeof event.details.revision === 'string' && /^[0-9a-f]{64}$/.test(event.details.revision) ? event.details.revision : null;
    const current = notes.get(event.object_id);
    if (!current) notes.set(event.object_id, {key: event.object_id, active: event.action === 'publish_house_markdown', revision, changedAt: event.occurred_at});
    else if (!current.active && !current.revision && revision) current.revision = revision;
  }
  return [...notes.values()].sort((a, b) => a.key.localeCompare(b.key));
}
