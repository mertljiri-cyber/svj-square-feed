-- Limit model calls using the authenticated identity; no question text is persisted.
create function public.consume_house_question(p_organization_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := app.require_user();
begin
  if not coalesce(app.is_active_member(p_organization_id), false) then
    raise exception 'Přístup zamítnut.' using errcode = 'PT403';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ask-house:' || uid::text, 0));
  perform app.enforce_rate_limit('ask-house', 12, interval '1 hour');
end $$;
revoke execute on function public.consume_house_question(uuid) from public, anon, authenticated;
grant execute on function public.consume_house_question(uuid) to authenticated;

create function public.search_house_terms(p_organization_id uuid, p_terms text[])
returns jsonb language sql stable security invoker set search_path = '' as $$
  with terms as (
    select distinct t from unnest(p_terms[1:8]) as u(t)
    where char_length(t) between 3 and 32 and t ~ '^[[:alnum:]]+$'
  ), matches as (
    select w.id,w.document_id,w.version_id,w.page,w.body,d.title,count(*) as score
    from public.wiki_excerpts w join public.documents d on d.id=w.document_id
    join terms on to_tsvector('simple',w.body||' '||d.title) @@ to_tsquery('simple',quote_literal(terms.t)||':*')
    where w.organization_id=p_organization_id
    group by w.id,d.title
    order by score desc,w.id limit 5
  )
  select coalesce(jsonb_agg(to_jsonb(matches)-'score' order by score desc,id),'[]'::jsonb) from matches;
$$;
revoke execute on function public.search_house_terms(uuid,text[]) from public, anon, authenticated;
grant execute on function public.search_house_terms(uuid,text[]) to authenticated;

create table public.wiki_markdown_revisions (
  organization_id uuid not null references public.organizations (id),
  note_key text not null check (note_key ~ '^[a-z0-9-]{1,80}$'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  object_key text generated always as (organization_id::text || '/' || note_key || '/' || content_sha256 || '.md') stored,
  imported_at timestamptz not null default now(),
  primary key (organization_id, note_key, content_sha256)
);
revoke all on public.wiki_markdown_revisions from public, anon, authenticated;
grant all on public.wiki_markdown_revisions to service_role;
alter table public.wiki_markdown_revisions enable row level security;