-- Block direct member access even if another policy later grants broad Storage access.
create policy house_release_no_client_access on storage.objects as restrictive
  for all to anon, authenticated using (bucket_id <> 'svj-wiki-releases')
  with check (bucket_id <> 'svj-wiki-releases');

create table app.house_file_releases (
  organization_id uuid not null references public.organizations(id),
  id uuid not null,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  primary key (organization_id,id)
);
create table app.house_file_release_state (
  organization_id uuid primary key references public.organizations(id),
  release_id uuid,
  updated_at timestamptz not null default now(),
  foreign key (organization_id,release_id) references app.house_file_releases (organization_id,id)
);
alter table app.house_file_releases enable row level security;
alter table app.house_file_release_state enable row level security;
revoke all on app.house_file_releases,app.house_file_release_state from public,anon,authenticated,service_role;

create function public.get_house_file_release(p_org uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not coalesce(app.is_active_member(p_org),false) then
    raise exception 'Přístup zamítnut.' using errcode='PT403';
  end if;
  return (select jsonb_build_object('id',s.release_id,'manifest_sha256',r.manifest_sha256)
    from app.house_file_release_state s left join app.house_file_releases r
      on r.organization_id=s.organization_id and r.id=s.release_id
    where s.organization_id=p_org);
end $$;
revoke execute on function public.get_house_file_release(uuid) from public,anon,authenticated,service_role;
grant execute on function public.get_house_file_release(uuid) to authenticated;

create function public.set_house_file_release(p_org uuid,p_release uuid,p_manifest_sha256 text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if (p_release is null) <> (p_manifest_sha256 is null) then
    raise exception 'Invalid release' using errcode='PT422';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('house-file-release:'||p_org::text,0));
  if p_release is not null then
    insert into app.house_file_releases (organization_id,id,manifest_sha256)
      values (p_org,p_release,p_manifest_sha256);
  end if;
  insert into app.house_file_release_state (organization_id,release_id) values (p_org,p_release)
    on conflict (organization_id) do update set release_id=excluded.release_id,updated_at=now();
end $$;
revoke execute on function public.set_house_file_release(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.set_house_file_release(uuid,uuid,text) to service_role;

alter function public.read_house_markdown(uuid,text[],text[]) set schema app;
revoke execute on function app.read_house_markdown(uuid,text[],text[]) from public,anon,authenticated,service_role;
create function public.read_house_markdown(p_org uuid,p_terms text[],p_ids text[] default null)
returns jsonb language sql stable security definer set search_path='' as $$
  select case when exists (select 1 from app.house_file_release_state where organization_id=p_org)
    then '[]'::jsonb else app.read_house_markdown(p_org,p_terms,p_ids) end;
$$;
revoke execute on function public.read_house_markdown(uuid,text[],text[]) from public,anon,authenticated,service_role;
grant execute on function public.read_house_markdown(uuid,text[],text[]) to authenticated;

create function public.consume_house_citation(p_organization_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare uid uuid := app.require_user();
begin
  if not coalesce(app.is_active_member(p_organization_id),false) then
    raise exception 'Přístup zamítnut.' using errcode='PT403';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('house-citation:'||uid::text,0));
  perform app.enforce_rate_limit('house-citation',60,interval '1 hour');
end $$;
revoke execute on function public.consume_house_citation(uuid) from public,anon,authenticated,service_role;
grant execute on function public.consume_house_citation(uuid) to authenticated;