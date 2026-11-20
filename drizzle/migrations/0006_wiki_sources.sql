-- E4: kurátorované zdroje pro budoucího asistenta. Žádný přístup k živému vaultu.
create table public.wiki_excerpts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  page integer not null check (page > 0),
  body text not null check (length(btrim(body)) between 1 and 3000),
  note_key text not null check (note_key ~ '^[a-z0-9-]{1,80}$'),
  source_revision text not null check (source_revision ~ '^[0-9a-f]{64}$'),
  approved_at timestamptz,
  unique (version_id, page, note_key, source_revision),
  foreign key (organization_id, document_id) references public.documents (organization_id, id),
  foreign key (document_id, version_id) references public.document_versions (document_id, id)
);
create index wiki_excerpts_organization_idx on public.wiki_excerpts (organization_id);
alter table public.wiki_excerpts enable row level security;
revoke all on public.wiki_excerpts from public, anon, authenticated;
grant select on public.wiki_excerpts to authenticated;

-- Jen ručně schválený společný korpus; stávající RLS archivu stále platí.
create policy wiki_excerpts_read on public.wiki_excerpts for select to authenticated
using (approved_at <= now() and exists (
  select 1 from public.documents d
  join public.document_versions v on v.document_id = d.id and v.id = d.current_version_id
  where d.id = wiki_excerpts.document_id and d.organization_id = wiki_excerpts.organization_id
    and v.id = wiki_excerpts.version_id and v.upload_status = 'ready' and v.mime_type = 'application/pdf'
    and d.lifecycle = 'published' and d.visibility = 'owners'
));

create function public.search_wiki_sources(p_organization_id uuid, p_query text, p_limit integer default 5)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.id), '[]'::jsonb)
  from (
    select w.id, w.document_id, w.version_id, w.page, w.body, d.title
    from public.wiki_excerpts w join public.documents d on d.id = w.document_id
    where w.organization_id = p_organization_id and length(btrim(p_query)) between 2 and 160
      and to_tsvector('simple', w.body || ' ' || d.title) @@ plainto_tsquery('simple', left(p_query, 160))
    order by w.id limit least(10, greatest(1, coalesce(p_limit, 5)))
  ) s;
$$;
revoke execute on function public.search_wiki_sources(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.search_wiki_sources(uuid, text, integer) to authenticated;