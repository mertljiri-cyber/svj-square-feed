create table public.request_counters (
  organization_id uuid primary key references public.organizations (id),
  last_number integer not null default 0
);

create table public.requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  number integer not null,
  author_user_id uuid not null references auth.users (id),
  type text not null check (type in ('defect', 'question', 'proposal')),
  title text not null check (length(title) between 3 and 200),
  description text not null check (length(description) between 3 and 5000),
  location text check (location is null or length(location) <= 120),
  asset_ref text check (asset_ref is null or asset_ref ~ '^[A-Z]{1,3}-[0-9]{3}$'),
  visibility text not null default 'private' check (visibility in ('private')),
  workflow_status text not null default 'new'
    check (workflow_status in ('new', 'triaged', 'in_progress', 'waiting', 'resolved', 'closed', 'rejected', 'duplicate')),
  triage_priority text check (triage_priority is null or triage_priority in ('low', 'normal', 'high', 'urgent')),
  assignee_user_id uuid references auth.users (id),
  due_on date,
  resolution_text text check (resolution_text is null or length(resolution_text) <= 5000),
  duplicate_of uuid,
  idempotency_key text check (idempotency_key is null or length(idempotency_key) between 8 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  unique (organization_id, number),
  unique (organization_id, id),
  foreign key (organization_id, duplicate_of) references public.requests (organization_id, id),
  check (duplicate_of is null or duplicate_of <> id),
  check (workflow_status <> 'duplicate' or duplicate_of is not null),
  check (workflow_status not in ('resolved', 'closed') or resolution_text is not null)
);
create unique index requests_idempotency_uniq on public.requests (organization_id, author_user_id, idempotency_key)
  where idempotency_key is not null;
create index requests_author_idx on public.requests (author_user_id, created_at desc);
create index requests_assignee_idx on public.requests (assignee_user_id) where assignee_user_id is not null;
create index requests_queue_idx on public.requests (organization_id, workflow_status, created_at desc);

create table public.request_events (
  id bigint generated always as identity primary key,
  organization_id uuid not null,
  request_id uuid not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  event_type text not null check (event_type in ('created', 'status_changed', 'comment', 'reopen_requested')),
  from_status text,
  to_status text,
  note text check (note is null or length(note) <= 5000),
  internal boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  foreign key (organization_id, request_id) references public.requests (organization_id, id) on delete cascade
);
create index request_events_request_idx on public.request_events (request_id, occurred_at);

create table public.notification_outbox (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  request_id uuid not null,
  event_id bigint references public.request_events (id) on delete set null,
  recipient_user_id uuid not null references auth.users (id) on delete cascade,
  channel text not null default 'email' check (channel = 'email'),
  kind text not null check (kind in ('request_created', 'request_status', 'request_assigned', 'request_comment')),
  idempotency_key text not null unique,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  retry_count integer not null default 0,
  last_error text,
  provider_message_id text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  foreign key (organization_id, request_id) references public.requests (organization_id, id) on delete cascade
);
create index notification_outbox_queue_idx on public.notification_outbox (status, created_at) where status <> 'sent';

create or replace function app.can_handle_request(p_org uuid, p_assignee uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_role(p_org, 'board')
      or (p_assignee is not null and p_assignee = auth.uid() and app.is_active_member(p_org));
$$;

create or replace function app.request_transition_allowed(p_from text, p_to text)
returns boolean language sql immutable set search_path = '' as $$
  select (p_from, p_to) in (
    ('new', 'triaged'), ('new', 'rejected'), ('new', 'duplicate'),
    ('triaged', 'in_progress'), ('triaged', 'waiting'), ('triaged', 'rejected'), ('triaged', 'duplicate'),
    ('in_progress', 'waiting'), ('in_progress', 'resolved'),
    ('waiting', 'in_progress'),
    ('resolved', 'closed'), ('resolved', 'in_progress'),
    ('closed', 'in_progress'),
    ('rejected', 'new'), ('duplicate', 'new')
  );
$$;

create or replace function app.board_user_ids(p_org uuid)
returns setof uuid language sql stable security definer set search_path = '' as $$
  select distinct m.user_id
  from public.memberships m
  join public.membership_roles r on r.membership_id = m.id
  where m.organization_id = p_org and m.status = 'active' and (m.valid_to is null or m.valid_to > now())
    and r.role = 'board' and r.revoked_at is null and (r.valid_to is null or r.valid_to > now());
$$;

create or replace function app.enqueue_notification(p_org uuid, p_request uuid, p_event bigint, p_recipient uuid, p_kind text)
returns void language sql security definer set search_path = '' as $$
  insert into public.notification_outbox (organization_id, request_id, event_id, recipient_user_id, kind, idempotency_key)
  values (p_org, p_request, p_event, p_recipient, p_kind, p_kind || ':' || p_event::text || ':' || p_recipient::text)
  on conflict (idempotency_key) do nothing;
$$;

create trigger requests_updated_at before update on public.requests for each row execute function app.set_updated_at();
create trigger requests_row_version before update on public.requests for each row execute function app.bump_row_version();
create trigger requests_protect before update on public.requests
  for each row execute function app.protect_columns('id', 'organization_id', 'number', 'author_user_id', 'type', 'created_at', 'idempotency_key');
create trigger requests_audit after insert or update or delete on public.requests
  for each row execute function app.audit_row('description', 'resolution_text', 'title', 'location');

create trigger request_events_no_update before update or delete on public.request_events
  for each row execute function app.audit_append_only();

alter table public.request_counters enable row level security;
alter table public.requests enable row level security;
alter table public.request_events enable row level security;
alter table public.notification_outbox enable row level security;

revoke all on public.request_counters, public.requests, public.request_events, public.notification_outbox from anon, authenticated;
grant select on public.requests, public.request_events to authenticated;
grant select on public.notification_outbox to authenticated;

create policy requests_author_read on public.requests for select to authenticated
  using (author_user_id = auth.uid() and app.is_active_member(organization_id));
create policy requests_board_read on public.requests for select to authenticated
  using (app.has_role(organization_id, 'board'));
create policy requests_assignee_read on public.requests for select to authenticated
  using (assignee_user_id = auth.uid() and app.is_active_member(organization_id));

create policy request_events_author_read on public.request_events for select to authenticated
  using (
    not internal and app.is_active_member(organization_id)
    and exists (select 1 from public.requests r where r.id = request_events.request_id and r.author_user_id = auth.uid())
  );
create policy request_events_handler_read on public.request_events for select to authenticated
  using (exists (
    select 1 from public.requests r
    where r.id = request_events.request_id and app.can_handle_request(r.organization_id, r.assignee_user_id)
  ));

create policy notification_outbox_board_read on public.notification_outbox for select to authenticated
  using (app.has_role(organization_id, 'board'));

create or replace function public.create_request(
  p_organization_id uuid, p_type text, p_title text, p_description text,
  p_location text default null, p_asset_ref text default null, p_idempotency_key text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_title text := btrim(coalesce(p_title, ''));
  v_desc text := btrim(coalesce(p_description, ''));
  v_loc text := nullif(btrim(coalesce(p_location, '')), '');
  v_asset text := nullif(btrim(coalesce(p_asset_ref, '')), '');
  v_key text := nullif(btrim(coalesce(p_idempotency_key, '')), '');
  v_existing public.requests%rowtype;
  v_number integer;
  v_id uuid;
  v_event bigint;
  v_board uuid;
begin
  if not app.is_active_member(p_organization_id) then
    raise exception 'Požadavek může podat jen aktivní člen SVJ.' using errcode = 'PT403';
  end if;
  if p_type is null or p_type not in ('defect', 'question', 'proposal') then
    raise exception 'Neplatný typ požadavku.' using errcode = 'PT422';
  end if;
  if length(v_title) not between 3 and 200 then
    raise exception 'Název musí mít 3 až 200 znaků.' using errcode = 'PT422';
  end if;
  if length(v_desc) not between 3 and 5000 then
    raise exception 'Popis musí mít 3 až 5000 znaků.' using errcode = 'PT422';
  end if;
  if v_loc is not null and length(v_loc) > 120 then
    raise exception 'Místo je delší než 120 znaků.' using errcode = 'PT422';
  end if;
  if v_asset is not null and v_asset !~ '^[A-Z]{1,3}-[0-9]{3}$' then
    raise exception 'Neplatný odkaz na technický prvek.' using errcode = 'PT422';
  end if;
  if v_key is not null and length(v_key) not between 8 and 100 then
    raise exception 'Neplatný klíč opakování.' using errcode = 'PT422';
  end if;

  if v_key is not null then
    select * into v_existing from public.requests
    where organization_id = p_organization_id and author_user_id = v_uid and idempotency_key = v_key;
    if v_existing.id is not null then
      return jsonb_build_object('id', v_existing.id, 'number', v_existing.number, 'duplicate', true);
    end if;
  end if;

  perform app.enforce_rate_limit('create_request', 10, interval '1 hour');

  insert into public.request_counters (organization_id, last_number) values (p_organization_id, 1)
  on conflict (organization_id) do update set last_number = public.request_counters.last_number + 1
  returning last_number into v_number;

  insert into public.requests (organization_id, number, author_user_id, type, title, description, location, asset_ref, idempotency_key)
  values (p_organization_id, v_number, v_uid, p_type, v_title, v_desc, v_loc, v_asset, v_key)
  returning id into v_id;

  insert into public.request_events (organization_id, request_id, actor_user_id, event_type, to_status)
  values (p_organization_id, v_id, v_uid, 'created', 'new')
  returning id into v_event;

  for v_board in select * from app.board_user_ids(p_organization_id) loop
    if v_board <> v_uid then
      perform app.enqueue_notification(p_organization_id, v_id, v_event, v_board, 'request_created');
    end if;
  end loop;

  return jsonb_build_object('id', v_id, 'number', v_number, 'duplicate', false);
end $$;

create or replace function public.add_request_comment(p_request_id uuid, p_body text, p_internal boolean default false)
returns bigint language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_body text := btrim(coalesce(p_body, ''));
  v_r public.requests%rowtype;
  v_event bigint;
  v_handler boolean;
  v_board uuid;
begin
  select * into v_r from public.requests where id = p_request_id;
  v_handler := v_r.id is not null and app.can_handle_request(v_r.organization_id, v_r.assignee_user_id);
  if v_r.id is null or not app.is_active_member(v_r.organization_id)
     or not (v_handler or v_r.author_user_id = v_uid) then
    raise exception 'Požadavek nebyl nalezen.' using errcode = 'PT404';
  end if;
  if length(v_body) not between 1 and 5000 then
    raise exception 'Komentář musí mít 1 až 5000 znaků.' using errcode = 'PT422';
  end if;
  if coalesce(p_internal, false) and not v_handler then
    raise exception 'Interní poznámku může psát jen výbor nebo řešitel.' using errcode = 'PT403';
  end if;
  if v_r.workflow_status in ('closed', 'rejected', 'duplicate') and not v_handler then
    raise exception 'Uzavřený požadavek nejprve znovu otevřete.' using errcode = 'PT409';
  end if;
  perform app.enforce_rate_limit('add_request_comment', 60, interval '1 hour');

  insert into public.request_events (organization_id, request_id, actor_user_id, event_type, note, internal)
  values (v_r.organization_id, v_r.id, v_uid, 'comment', v_body, coalesce(p_internal, false))
  returning id into v_event;

  if not coalesce(p_internal, false) then
    if v_uid = v_r.author_user_id then
      if v_r.assignee_user_id is not null then
        perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_r.assignee_user_id, 'request_comment');
      end if;
      for v_board in select * from app.board_user_ids(v_r.organization_id) loop
        if v_board <> v_uid then
          perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_board, 'request_comment');
        end if;
      end loop;
    else
      perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_r.author_user_id, 'request_comment');
    end if;
  end if;
  return v_event;
end $$;

create or replace function public.request_reopen(p_request_id uuid, p_reason text, p_expected_row_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_reason text := btrim(coalesce(p_reason, ''));
  v_r public.requests%rowtype;
  v_event bigint;
  v_version integer;
  v_board uuid;
begin
  select * into v_r from public.requests where id = p_request_id for update;
  if v_r.id is null or v_r.author_user_id <> v_uid or not app.is_active_member(v_r.organization_id) then
    raise exception 'Požadavek nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_r.row_version <> p_expected_row_version then
    raise exception 'Požadavek mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if v_r.workflow_status not in ('resolved', 'closed') then
    raise exception 'Znovu otevřít lze jen vyřešený nebo uzavřený požadavek.' using errcode = 'PT422';
  end if;
  if length(v_reason) not between 3 and 2000 then
    raise exception 'Uveďte důvod znovuotevření (3 až 2000 znaků).' using errcode = 'PT422';
  end if;

  update public.requests set workflow_status = 'new', resolution_text = null where id = v_r.id
  returning row_version into v_version;

  insert into public.request_events (organization_id, request_id, actor_user_id, event_type, from_status, to_status, note)
  values (v_r.organization_id, v_r.id, v_uid, 'reopen_requested', v_r.workflow_status, 'new', v_reason)
  returning id into v_event;

  for v_board in select * from app.board_user_ids(v_r.organization_id) loop
    perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_board, 'request_status');
  end loop;
  return v_version;
end $$;

create or replace function public.change_request_status(
  p_request_id uuid, p_to text, p_expected_row_version integer,
  p_note text default null, p_assignee uuid default null, p_due_on date default null,
  p_resolution text default null, p_duplicate_of uuid default null, p_priority text default null
) returns integer language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_r public.requests%rowtype;
  v_board boolean;
  v_handler boolean;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_resolution text := nullif(btrim(coalesce(p_resolution, '')), '');
  v_assignee uuid;
  v_event bigint;
  v_version integer;
  v_clear_resolution boolean;
begin
  select * into v_r from public.requests where id = p_request_id for update;
  if v_r.id is null or not app.is_active_member(v_r.organization_id) then
    raise exception 'Požadavek nebyl nalezen.' using errcode = 'PT404';
  end if;
  v_board := app.has_role(v_r.organization_id, 'board');
  v_handler := app.can_handle_request(v_r.organization_id, v_r.assignee_user_id);
  if not v_handler then
    if v_r.author_user_id = v_uid then
      raise exception 'Stav požadavku mění výbor nebo řešitel.' using errcode = 'PT403';
    end if;
    raise exception 'Požadavek nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_r.row_version <> p_expected_row_version then
    raise exception 'Požadavek mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if p_to is null or not app.request_transition_allowed(v_r.workflow_status, p_to) then
    raise exception 'Přechod % -> % není povolen.', v_r.workflow_status, coalesce(p_to, 'NULL') using errcode = 'PT422';
  end if;
  if not v_board and p_to not in ('in_progress', 'waiting', 'resolved') then
    raise exception 'Tento přechod vyžaduje výbor.' using errcode = 'PT403';
  end if;
  if not v_board and (p_assignee is not null or p_priority is not null or p_duplicate_of is not null) then
    raise exception 'Přidělení a prioritu nastavuje výbor.' using errcode = 'PT403';
  end if;
  if p_priority is not null and p_priority not in ('low', 'normal', 'high', 'urgent') then
    raise exception 'Neplatná priorita.' using errcode = 'PT422';
  end if;
  if v_resolution is not null and length(v_resolution) > 5000 then
    raise exception 'Výsledek je delší než 5000 znaků.' using errcode = 'PT422';
  end if;
  if v_note is not null and length(v_note) > 5000 then
    raise exception 'Poznámka je delší než 5000 znaků.' using errcode = 'PT422';
  end if;

  v_assignee := coalesce(p_assignee, v_r.assignee_user_id);
  if p_assignee is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id = v_r.organization_id and m.user_id = p_assignee and m.status = 'active'
      and (m.valid_to is null or m.valid_to > now())
  ) then
    raise exception 'Řešitel musí být aktivní člen SVJ.' using errcode = 'PT422';
  end if;

  if p_to = 'triaged' and v_assignee is null and v_note is null then
    raise exception 'Zařazení vyžaduje řešitele nebo důvod nepřiřazení.' using errcode = 'PT422';
  end if;
  if p_to in ('rejected', 'duplicate') and v_note is null then
    raise exception 'Zamítnutí a duplicita vyžadují vysvětlení.' using errcode = 'PT422';
  end if;
  if p_to = 'duplicate' then
    if p_duplicate_of is null or p_duplicate_of = v_r.id or not exists (
      select 1 from public.requests d where d.id = p_duplicate_of and d.organization_id = v_r.organization_id
    ) then
      raise exception 'Duplicita vyžaduje jiný požadavek téhož SVJ.' using errcode = 'PT422';
    end if;
  end if;
  if p_to = 'resolved' and v_resolution is null and v_r.resolution_text is null then
    raise exception 'Vyřešení vyžaduje popis výsledku.' using errcode = 'PT422';
  end if;
  if p_to = 'in_progress' and v_r.workflow_status in ('resolved', 'closed') and v_note is null then
    raise exception 'Znovuotevření vyžaduje důvod.' using errcode = 'PT422';
  end if;

  v_clear_resolution := p_to in ('in_progress', 'new', 'triaged', 'waiting') and v_r.workflow_status in ('resolved', 'closed');

  update public.requests set
    workflow_status = p_to,
    assignee_user_id = v_assignee,
    due_on = coalesce(p_due_on, due_on),
    triage_priority = coalesce(p_priority, triage_priority),
    resolution_text = case when v_clear_resolution then null else coalesce(v_resolution, resolution_text) end,
    duplicate_of = case when p_to = 'duplicate' then p_duplicate_of else null end
  where id = v_r.id
  returning row_version into v_version;

  insert into public.request_events (organization_id, request_id, actor_user_id, event_type, from_status, to_status, note, details)
  values (v_r.organization_id, v_r.id, v_uid, 'status_changed', v_r.workflow_status, p_to, v_note,
    jsonb_strip_nulls(jsonb_build_object('assignee', v_assignee, 'due_on', p_due_on, 'priority', p_priority)))
  returning id into v_event;

  if v_r.author_user_id <> v_uid then
    perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_r.author_user_id, 'request_status');
  end if;
  if v_assignee is not null and v_assignee is distinct from v_r.assignee_user_id and v_assignee <> v_uid then
    perform app.enqueue_notification(v_r.organization_id, v_r.id, v_event, v_assignee, 'request_assigned');
  end if;
  return v_version;
end $$;

create or replace function public.request_people(p_request_ids uuid[])
returns table (user_id uuid, display_name text) language sql stable security definer set search_path = '' as $$
  select distinct p.user_id, p.display_name
  from public.requests r
  join public.profiles p on p.user_id in (r.author_user_id, r.assignee_user_id)
  where r.id = any (p_request_ids)
    and (app.has_role(r.organization_id, 'board') or r.assignee_user_id = auth.uid());
$$;

revoke execute on function app.can_handle_request(uuid, uuid), app.request_transition_allowed(text, text),
  app.board_user_ids(uuid), app.enqueue_notification(uuid, uuid, bigint, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_request(uuid, text, text, text, text, text, text),
  public.add_request_comment(uuid, text, boolean), public.request_reopen(uuid, text, integer),
  public.change_request_status(uuid, text, integer, text, uuid, date, text, uuid, text),
  public.request_people(uuid[]) from public, anon;
grant execute on function public.create_request(uuid, text, text, text, text, text, text),
  public.add_request_comment(uuid, text, boolean), public.request_reopen(uuid, text, integer),
  public.change_request_status(uuid, text, integer, text, uuid, date, text, uuid, text),
  public.request_people(uuid[]) to authenticated;
grant execute on function app.can_handle_request(uuid, uuid) to authenticated;