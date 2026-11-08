alter table public.intents
  add column location text check (location is null or length(location) <= 120),
  add column estimated_cost numeric(14, 2) check (estimated_cost is null or estimated_cost >= 0),
  add column planned_year integer check (planned_year is null or planned_year between 1900 and 2100),
  add column decision_note text check (decision_note is null or length(decision_note) <= 2000),
  add constraint intents_org_id_uniq unique (organization_id, id);

create table public.intent_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  intent_id uuid not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('created', 'edited', 'status_changed', 'comment')),
  from_status text,
  to_status text,
  note text check (note is null or length(note) <= 5000),
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, intent_id) references public.intents (organization_id, id) on delete cascade
);
create index intent_events_intent_idx on public.intent_events (intent_id, occurred_at);
create trigger intent_events_no_update before update on public.intent_events
  for each row execute function app.audit_append_only();

alter table public.intent_events enable row level security;
revoke all on public.intent_events from anon, authenticated;
grant select on public.intent_events to authenticated;
create policy intent_events_member_read on public.intent_events for select to authenticated
  using (app.is_active_member(organization_id));

drop policy if exists intents_manager_update on public.intents;
revoke update on public.intents from authenticated;

create or replace function public.submit_intent(p_organization_id uuid, p_title text, p_description text, p_proposer_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_title text := btrim(coalesce(p_title, ''));
  v_description text := btrim(coalesce(p_description, ''));
  v_proposer text := nullif(btrim(coalesce(p_proposer_name, '')), '');
  v_id uuid;
begin
  if not app.is_active_member(p_organization_id) then
    raise exception 'Záměr může podat jen aktivní člen SVJ.' using errcode = 'PT403';
  end if;
  if length(v_title) not between 3 and 200 then
    raise exception 'Název záměru musí mít 3 až 200 znaků.' using errcode = 'PT422';
  end if;
  if length(v_description) > 5000 then
    raise exception 'Popis záměru je delší než 5000 znaků.' using errcode = 'PT422';
  end if;
  if v_proposer is not null and length(v_proposer) > 120 then
    raise exception 'Jméno navrhovatele je delší než 120 znaků.' using errcode = 'PT422';
  end if;
  perform app.enforce_rate_limit('submit_intent', 10, interval '1 hour');
  if v_proposer is null then
    select nullif(btrim(display_name), '') into v_proposer from public.profiles where user_id = v_uid;
  end if;
  insert into public.intents (organization_id, title, description, proposer_name, status, priority, created_by)
  values (p_organization_id, v_title, nullif(v_description, ''), v_proposer, 'navrh', 'medium', v_uid)
  returning id into v_id;
  insert into public.intent_events (organization_id, intent_id, actor_user_id, event_type, to_status)
  values (p_organization_id, v_id, v_uid, 'created', 'navrh');
  return v_id;
end $$;

create or replace function public.update_intent(
  p_intent_id uuid, p_title text, p_description text, p_priority text, p_location text,
  p_estimated_cost numeric, p_planned_year integer, p_expected_row_version integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_i public.intents%rowtype;
  v_manager boolean;
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := nullif(btrim(coalesce(p_description, '')), '');
  v_loc text := nullif(btrim(coalesce(p_location, '')), '');
  v_changed text[] := '{}';
  v_version integer;
begin
  select * into v_i from public.intents where id = p_intent_id for update;
  if v_i.id is null or not app.is_active_member(v_i.organization_id) then
    raise exception 'Záměr nebyl nalezen.' using errcode = 'PT404';
  end if;
  v_manager := app.can_manage(v_i.organization_id, 'intents');
  if not v_manager and v_i.created_by is distinct from v_uid then
    raise exception 'Záměr může upravit jeho autor nebo správce záměrů.' using errcode = 'PT403';
  end if;
  if not v_manager and v_i.status <> 'navrh' then
    raise exception 'Autor může upravit záměr jen ve stavu návrh.' using errcode = 'PT403';
  end if;
  if v_i.row_version <> p_expected_row_version then
    raise exception 'Záměr mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if length(v_title) not between 3 and 200 then
    raise exception 'Název záměru musí mít 3 až 200 znaků.' using errcode = 'PT422';
  end if;
  if length(coalesce(v_desc, '')) > 5000 then
    raise exception 'Popis záměru je delší než 5000 znaků.' using errcode = 'PT422';
  end if;
  if v_loc is not null and length(v_loc) > 120 then
    raise exception 'Místo je delší než 120 znaků.' using errcode = 'PT422';
  end if;
  if p_priority is null or p_priority not in ('low', 'medium', 'high') then
    raise exception 'Neplatná priorita.' using errcode = 'PT422';
  end if;
  if p_estimated_cost is not null and (p_estimated_cost < 0 or p_estimated_cost >= 100000000000) then
    raise exception 'Odhad nákladů musí být nezáporné číslo.' using errcode = 'PT422';
  end if;
  if p_planned_year is not null and p_planned_year not between 1900 and 2100 then
    raise exception 'Plánovaný rok musí být mezi 1900 a 2100.' using errcode = 'PT422';
  end if;
  if not v_manager and (
        p_priority is distinct from v_i.priority or p_estimated_cost is distinct from v_i.estimated_cost
       or p_planned_year is distinct from v_i.planned_year) then
    raise exception 'Prioritu, odhad nákladů a rok nastavuje správce záměrů.' using errcode = 'PT403';
  end if;

  if v_title is distinct from v_i.title then v_changed := array_append(v_changed, 'title'::text); end if;
  if v_desc is distinct from v_i.description then v_changed := array_append(v_changed, 'description'::text); end if;
  if v_loc is distinct from v_i.location then v_changed := array_append(v_changed, 'location'::text); end if;
  if p_priority is distinct from v_i.priority then v_changed := array_append(v_changed, 'priority'::text); end if;
  if p_estimated_cost is distinct from v_i.estimated_cost then v_changed := array_append(v_changed, 'estimated_cost'::text); end if;
  if p_planned_year is distinct from v_i.planned_year then v_changed := array_append(v_changed, 'planned_year'::text); end if;
  if array_length(v_changed, 1) is null then
    return v_i.row_version;
  end if;

  update public.intents set title = v_title, description = v_desc, location = v_loc, priority = p_priority,
    estimated_cost = p_estimated_cost, planned_year = p_planned_year
  where id = v_i.id returning row_version into v_version;
  insert into public.intent_events (organization_id, intent_id, actor_user_id, event_type, details)
  values (v_i.organization_id, v_i.id, v_uid, 'edited', jsonb_build_object('fields', to_jsonb(v_changed)));
  return v_version;
end $$;

drop function public.change_intent_status(uuid, text, integer);
create function public.change_intent_status(p_intent_id uuid, p_status text, p_expected_row_version integer, p_decision_note text default null)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_i public.intents%rowtype;
  v_note text := nullif(btrim(coalesce(p_decision_note, '')), '');
  v_version integer;
begin
  select * into v_i from public.intents where id = p_intent_id for update;
  if v_i.id is null or not app.is_active_member(v_i.organization_id) then
    raise exception 'Záměr nebyl nalezen.' using errcode = 'PT404';
  end if;
  if not app.can_manage(v_i.organization_id, 'intents') then
    raise exception 'Změna stavu záměru vyžaduje oprávnění správy záměrů.' using errcode = 'PT403';
  end if;
  if v_i.row_version <> p_expected_row_version then
    raise exception 'Záměr mezitím změnil někdo jiný. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'Odkaz na rozhodnutí je delší než 2000 znaků.' using errcode = 'PT422';
  end if;
  if p_status = 'schvaleno' and v_note is null then
    raise exception 'Schválení vyžaduje odkaz na rozhodnutí (např. usnesení, datum a číslo bodu).' using errcode = 'PT422';
  end if;
  update public.intents set status = p_status, decision_note = case when p_status = 'schvaleno' then v_note else decision_note end
  where id = p_intent_id returning row_version into v_version;
  insert into public.intent_events (organization_id, intent_id, actor_user_id, event_type, from_status, to_status, note)
  values (v_i.organization_id, v_i.id, v_uid, 'status_changed', v_i.status, p_status, v_note);
  return v_version;
end $$;

create or replace function public.add_intent_comment(p_intent_id uuid, p_body text)
returns bigint language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_org uuid; v_body text := btrim(coalesce(p_body, '')); v_id bigint;
begin
  select organization_id into v_org from public.intents where id = p_intent_id;
  if v_org is null or not app.is_active_member(v_org) then
    raise exception 'Záměr nebyl nalezen.' using errcode = 'PT404';
  end if;
  if length(v_body) not between 1 and 5000 then
    raise exception 'Komentář musí mít 1 až 5000 znaků.' using errcode = 'PT422';
  end if;
  perform app.enforce_rate_limit('add_intent_comment', 60, interval '1 hour');
  insert into public.intent_events (organization_id, intent_id, actor_user_id, event_type, note)
  values (v_org, p_intent_id, v_uid, 'comment', v_body) returning id into v_id;
  return v_id;
end $$;

create or replace function public.intent_people(p_intent_id uuid)
returns table (user_id uuid, display_name text) language sql stable security definer set search_path = '' as $$
  select distinct p.user_id, p.display_name
  from public.intents i
  join public.intent_events e on e.intent_id = i.id
  join public.profiles p on p.user_id = e.actor_user_id
  where i.id = p_intent_id and app.is_active_member(i.organization_id);
$$;

revoke execute on function public.update_intent(uuid, text, text, text, text, numeric, integer, integer),
  public.change_intent_status(uuid, text, integer, text), public.add_intent_comment(uuid, text),
  public.intent_people(uuid) from public, anon;
grant execute on function public.update_intent(uuid, text, text, text, text, numeric, integer, integer),
  public.change_intent_status(uuid, text, integer, text), public.add_intent_comment(uuid, text),
  public.intent_people(uuid) to authenticated;