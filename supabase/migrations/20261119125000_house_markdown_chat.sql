-- Whole shared Markdown revisions, stored privately in the portal database.
create table app.house_markdown (
  organization_id uuid not null references public.organizations(id),
  note_key text not null,
  revision text not null,
  title text not null,
  markdown text not null,
  active boolean not null default false,
  primary key (organization_id,note_key,revision)
);
alter table app.house_markdown enable row level security;
revoke all on app.house_markdown from public, anon, authenticated;
create unique index house_markdown_current on app.house_markdown (organization_id,note_key) where active;

create function public.publish_house_markdown(p_org uuid,p_key text,p_title text,p_markdown text)
returns text language plpgsql security definer set search_path='' as $$
declare rev text;
begin
  if not coalesce(app.has_role(p_org,'board'),false) then
    raise exception 'Přístup zamítnut.' using errcode='PT403';
  end if;
  if p_key is null or p_key !~ '^[a-z0-9-]{1,80}$' or coalesce(char_length(btrim(p_title)),0) not between 1 and 160
    or coalesce(octet_length(p_markdown),0) not between 1 and 60000 then
    raise exception 'Neplatná poznámka.' using errcode='PT422';
  end if;
  rev := encode(sha256(convert_to(jsonb_build_array(p_title,p_markdown)::text,'UTF8')),'hex');
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('house-md:'||p_org::text||':'||p_key,0));
  if exists(select 1 from app.house_markdown n where n.organization_id=p_org and n.note_key=p_key and n.revision=rev and n.active) then return rev; end if;
  update app.house_markdown set active=false where organization_id=p_org and note_key=p_key and active;
  insert into app.house_markdown values (p_org,p_key,rev,btrim(p_title),p_markdown,true)
    on conflict (organization_id,note_key,revision) do update set active=true;
  perform app.log_event(p_org,'publish_house_markdown','house_markdown',p_key,jsonb_build_object('revision',rev));
  return rev;
end $$;

create function public.withdraw_house_markdown(p_org uuid,p_key text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if not coalesce(app.has_role(p_org,'board'),false) then raise exception 'Přístup zamítnut.' using errcode='PT403'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('house-md:'||p_org::text||':'||p_key,0));
  update app.house_markdown set active=false where organization_id=p_org and note_key=p_key and active;
  if found then perform app.log_event(p_org,'withdraw_house_markdown','house_markdown',p_key,'{}'); end if;
end $$;

create function public.read_house_markdown(p_org uuid,p_terms text[],p_ids text[] default null)
returns jsonb language sql stable security definer set search_path='' as $$
  with lines as (
    select n.note_key,n.revision,n.title,l.line_no,btrim(l.body) as body,
      count(*) filter(where l.body ~ '^#{1,6}[[:space:]]') over(partition by n.note_key order by l.line_no) as heading_group
    from app.house_markdown n cross join lateral regexp_split_to_table(n.markdown,E'\\r?\\n') with ordinality as l(body,line_no)
    where n.organization_id=p_org and n.active and app.is_active_member(p_org)
  ), passages as (
    select note_key||':'||revision||':'||line_no::text as id, note_key,revision,title,
      coalesce(max(regexp_replace(body,'^#{1,6}[[:space:]]+','')) filter(where body ~ '^#{1,6}[[:space:]]')
        over(partition by note_key,heading_group),title) as section, left(body,2400) as body
    from lines
  ), terms as (
    select distinct t from unnest(p_terms[1:8]) as u(t) where char_length(t) between 3 and 32 and t ~ '^[[:alnum:]]+$'
  ), ranked as (
    select p.*,(select count(*) from terms where to_tsvector('simple',p.body||' '||p.title||' '||p.section) @@ to_tsquery('simple',quote_literal(t)||':*')) as score
    from passages p where char_length(p.body)>=12 and p.body !~ '^#{1,6}[[:space:]]'
  ), matches as (
    select * from ranked where case when p_ids is null then score>0 else id=any(p_ids[1:5]) end
    order by score desc,id limit 5
  )
  select coalesce(jsonb_agg(to_jsonb(matches)-'score' order by score desc,id),'[]'::jsonb) from matches;
$$;
revoke execute on function public.publish_house_markdown(uuid,text,text,text),public.withdraw_house_markdown(uuid,text),public.read_house_markdown(uuid,text[],text[]) from public, anon, authenticated;
grant execute on function public.publish_house_markdown(uuid,text,text,text),public.withdraw_house_markdown(uuid,text),public.read_house_markdown(uuid,text[],text[]) to authenticated;
