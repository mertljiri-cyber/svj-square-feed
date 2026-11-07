create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to anon, authenticated, service_role;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 1 and 200),
  timezone text not null default 'Europe/Prague',
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (display_name is null or length(display_name) <= 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'invited' check (status in ('invited', 'active', 'suspended', 'ended')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  invitation_id uuid,
  approved_by uuid references auth.users (id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  unique (organization_id, user_id),
  unique (organization_id, id)
);
create index memberships_user_idx on public.memberships (user_id);

create table public.membership_roles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null,
  role text not null check (role in ('owner', 'board', 'manager', 'technical', 'system_admin')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  foreign key (organization_id, membership_id) references public.memberships (organization_id, id) on delete cascade
);
create unique index membership_roles_active_uniq on public.membership_roles (membership_id, role) where revoked_at is null;
create index membership_roles_org_idx on public.membership_roles (organization_id);

create table public.scoped_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  membership_id uuid not null,
  scope text not null check (scope in ('news', 'intents', 'forms', 'settings')),
  permission text not null check (permission in ('read', 'write', 'approve')),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  foreign key (organization_id, membership_id) references public.memberships (organization_id, id) on delete cascade
);
create unique index scoped_grants_active_uniq on public.scoped_grants (membership_id, scope, permission) where revoked_at is null;

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 320 and position('@' in email) > 1),
  role text not null default 'owner' check (role in ('owner', 'board', 'manager', 'technical')),
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null
);
create index invitations_org_idx on public.invitations (organization_id);

alter table public.memberships
  add constraint memberships_invitation_fk foreign key (invitation_id) references public.invitations (id) on delete set null;

create table public.audit_events (
  id bigint generated always as identity primary key,
  organization_id uuid references public.organizations (id),
  actor_user_id uuid,
  action text not null,
  object_type text not null,
  object_id text,
  occurred_at timestamptz not null default now(),
  tx_id bigint not null default txid_current(),
  details jsonb not null default '{}'::jsonb
);
create index audit_events_org_idx on public.audit_events (organization_id, occurred_at desc);

create table app.rate_events (
  user_id uuid not null,
  kind text not null,
  occurred_at timestamptz not null default now()
);
create index rate_events_idx on app.rate_events (user_id, kind, occurred_at);

create or replace function app.is_active_member(p_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.valid_from <= now()
      and (m.valid_to is null or m.valid_to > now())
  );
$$;

create or replace function app.has_role(p_org uuid, p_role text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships m
    join public.membership_roles r on r.membership_id = m.id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.valid_from <= now()
      and (m.valid_to is null or m.valid_to > now())
      and r.role = p_role
      and r.revoked_at is null
      and r.valid_from <= now()
      and (r.valid_to is null or r.valid_to > now())
  );
$$;

create or replace function app.has_grant(p_org uuid, p_scope text, p_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.memberships m
    join public.scoped_grants g on g.membership_id = m.id
    where m.organization_id = p_org
      and m.user_id = auth.uid()
      and m.status = 'active'
      and m.valid_from <= now()
      and (m.valid_to is null or m.valid_to > now())
      and g.scope = p_scope
      and (g.permission = p_permission or (p_permission = 'read' and g.permission = 'write'))
      and g.revoked_at is null
      and g.valid_from <= now()
      and (g.valid_to is null or g.valid_to > now())
  );
$$;

create or replace function app.can_manage(p_org uuid, p_scope text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_role(p_org, 'board') or app.has_grant(p_org, p_scope, 'write');
$$;

create or replace function app.can_approve(p_org uuid, p_scope text)
returns boolean language sql stable security definer set search_path = '' as $$
  select app.has_role(p_org, 'board') or app.has_grant(p_org, p_scope, 'approve');
$$;

create or replace function app.require_user()
returns uuid language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Přihlášení je vyžadováno.' using errcode = 'PT401';
  end if;
  return v_uid;
end $$;

create or replace function app.require_board(p_org uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user();
begin
  if not app.has_role(p_org, 'board') then
    raise exception 'Operace vyžaduje roli výboru.' using errcode = 'PT403';
  end if;
  return v_uid;
end $$;

create or replace function app.enforce_rate_limit(p_kind text, p_max integer, p_window interval)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_count integer;
begin
  delete from app.rate_events where occurred_at < now() - interval '1 day';
  select count(*) into v_count from app.rate_events
    where user_id = v_uid and kind = p_kind and occurred_at > now() - p_window;
  if v_count >= p_max then
    raise exception 'Příliš mnoho požadavků. Zkuste to později.' using errcode = 'PT429';
  end if;
  insert into app.rate_events (user_id, kind) values (v_uid, p_kind);
end $$;

create or replace function app.other_active_board_count(p_org uuid, p_membership_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select count(distinct m.id)::integer
  from public.memberships m
  join public.membership_roles r on r.membership_id = m.id
  where m.organization_id = p_org
    and m.id <> p_membership_id
    and m.status = 'active'
    and (m.valid_to is null or m.valid_to > now())
    and r.role = 'board'
    and r.revoked_at is null
    and (r.valid_to is null or r.valid_to > now());
$$;

create or replace function app.is_board_membership(p_membership_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.membership_roles r
    where r.membership_id = p_membership_id and r.role = 'board' and r.revoked_at is null
      and (r.valid_from <= now())
      and (r.valid_to is null or r.valid_to > now())
  );
$$;

create or replace function app.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create or replace function app.bump_row_version()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.row_version := old.row_version + 1;
  return new;
end $$;

create or replace function app.protect_columns()
returns trigger language plpgsql set search_path = '' as $$
declare v_col text; v_old jsonb := to_jsonb(old); v_new jsonb := to_jsonb(new);
begin
  foreach v_col in array tg_argv loop
    if (v_old -> v_col) is distinct from (v_new -> v_col) then
      raise exception 'Sloupec %.% nelze měnit.', tg_table_name, v_col using errcode = 'PT403';
    end if;
  end loop;
  return new;
end $$;

create or replace function app.audit_row()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_key text;
  v_changes jsonb := '{}'::jsonb;
  v_rec jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then v_old := to_jsonb(old); end if;
  if tg_op in ('INSERT', 'UPDATE') then v_new := to_jsonb(new); end if;
  v_rec := coalesce(v_new, v_old);
  for v_key in select jsonb_object_keys(v_rec) loop
    continue when v_key in ('updated_at', 'row_version');
    continue when (v_old -> v_key) is not distinct from (v_new -> v_key);
    if v_key = any (tg_argv) then
      v_changes := v_changes || jsonb_build_object(v_key, '[neukládá se]');
    else
      v_changes := v_changes || jsonb_build_object(v_key, jsonb_build_object('old', v_old -> v_key, 'new', v_new -> v_key));
    end if;
  end loop;
  if tg_op = 'UPDATE' and v_changes = '{}'::jsonb then
    return new;
  end if;
  insert into public.audit_events (organization_id, actor_user_id, action, object_type, object_id, details)
  values (
    case when tg_table_name = 'organizations' then (v_rec ->> 'id')::uuid else (v_rec ->> 'organization_id')::uuid end,
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce(v_rec ->> 'id', v_rec ->> 'user_id'),
    v_changes
  );
  return coalesce(new, old);
end $$;

create or replace function app.audit_append_only()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Auditní záznamy nelze měnit ani mazat.' using errcode = 'PT403';
end $$;

create or replace function app.log_event(p_org uuid, p_action text, p_object_type text, p_object_id text, p_details jsonb)
returns void language sql security definer set search_path = '' as $$
  insert into public.audit_events (organization_id, actor_user_id, action, object_type, object_id, details)
  values (p_org, auth.uid(), p_action, p_object_type, p_object_id, coalesce(p_details, '{}'::jsonb));
$$;

create or replace function app.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
insert into public.profiles (user_id) select id from auth.users on conflict (user_id) do nothing;

create trigger profiles_updated_at before update on public.profiles for each row execute function app.set_updated_at();
create trigger profiles_protect before update on public.profiles for each row execute function app.protect_columns('user_id', 'created_at');

create trigger memberships_updated_at before update on public.memberships for each row execute function app.set_updated_at();
create trigger memberships_row_version before update on public.memberships for each row execute function app.bump_row_version();
create trigger memberships_protect before update on public.memberships for each row execute function app.protect_columns('organization_id', 'user_id', 'created_at');
create trigger memberships_audit after insert or update or delete on public.memberships for each row execute function app.audit_row();

create trigger membership_roles_protect before update on public.membership_roles for each row execute function app.protect_columns('organization_id', 'membership_id', 'role', 'granted_by', 'granted_at');
create trigger membership_roles_audit after insert or update or delete on public.membership_roles for each row execute function app.audit_row();

create trigger scoped_grants_protect before update on public.scoped_grants for each row execute function app.protect_columns('organization_id', 'membership_id', 'scope', 'permission', 'granted_by', 'granted_at');
create trigger scoped_grants_audit after insert or update or delete on public.scoped_grants for each row execute function app.audit_row();

create trigger invitations_protect before update on public.invitations for each row execute function app.protect_columns('organization_id', 'email', 'role', 'token_hash', 'created_by', 'created_at');
create trigger invitations_audit after insert or update or delete on public.invitations for each row execute function app.audit_row('token_hash', 'email');

create trigger organizations_audit after insert or update or delete on public.organizations for each row execute function app.audit_row();

create trigger audit_events_no_update before update or delete on public.audit_events for each row execute function app.audit_append_only();
create trigger audit_events_no_truncate before truncate on public.audit_events for each statement execute function app.audit_append_only();

alter table public.organizations enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.membership_roles enable row level security;
alter table public.scoped_grants enable row level security;
alter table public.invitations enable row level security;
alter table public.audit_events enable row level security;

revoke all on public.organizations, public.profiles, public.memberships, public.membership_roles,
  public.scoped_grants, public.invitations, public.audit_events from anon, authenticated;
revoke all on app.rate_events from public, anon, authenticated;

grant select on public.organizations, public.profiles, public.memberships, public.membership_roles,
  public.scoped_grants, public.invitations, public.audit_events to authenticated;
grant update (display_name) on public.profiles to authenticated;

create policy organizations_member_read on public.organizations for select to authenticated
  using (
    exists (select 1 from public.memberships m where m.organization_id = organizations.id and m.user_id = auth.uid())
  );

create policy profiles_self_read on public.profiles for select to authenticated
  using (user_id = auth.uid());
create policy profiles_board_read on public.profiles for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.user_id = profiles.user_id and app.has_role(m.organization_id, 'board')
  ));
create policy profiles_self_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy memberships_self_read on public.memberships for select to authenticated
  using (user_id = auth.uid());
create policy memberships_board_read on public.memberships for select to authenticated
  using (app.has_role(organization_id, 'board'));

create policy membership_roles_self_read on public.membership_roles for select to authenticated
  using (exists (select 1 from public.memberships m where m.id = membership_roles.membership_id and m.user_id = auth.uid()));
create policy membership_roles_board_read on public.membership_roles for select to authenticated
  using (app.has_role(organization_id, 'board'));

create policy scoped_grants_self_read on public.scoped_grants for select to authenticated
  using (exists (select 1 from public.memberships m where m.id = scoped_grants.membership_id and m.user_id = auth.uid()));
create policy scoped_grants_board_read on public.scoped_grants for select to authenticated
  using (app.has_role(organization_id, 'board'));

create policy invitations_board_read on public.invitations for select to authenticated
  using (app.has_role(organization_id, 'board'));

create policy audit_events_board_read on public.audit_events for select to authenticated
  using (organization_id is not null and app.has_role(organization_id, 'board'));
create policy audit_events_self_read on public.audit_events for select to authenticated
  using (actor_user_id = auth.uid());

create or replace function public.my_context()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'user_id', auth.uid(),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'membership_id', m.id,
        'organization_id', m.organization_id,
        'organization_name', o.name,
        'status', case when m.status = 'active' and m.valid_to is not null and m.valid_to <= now() then 'ended' else m.status end,
        'row_version', m.row_version,
        'roles', coalesce((
          select jsonb_agg(r.role order by r.role) from public.membership_roles r
          where r.membership_id = m.id and r.revoked_at is null and r.valid_from <= now() and (r.valid_to is null or r.valid_to > now())
        ), '[]'::jsonb),
        'grants', coalesce((
          select jsonb_agg(jsonb_build_object('scope', g.scope, 'permission', g.permission)) from public.scoped_grants g
          where g.membership_id = m.id and g.revoked_at is null and g.valid_from <= now() and (g.valid_to is null or g.valid_to > now())
        ), '[]'::jsonb)
      ) order by o.name)
      from public.memberships m join public.organizations o on o.id = m.organization_id
      where m.user_id = auth.uid()
    ), '[]'::jsonb)
  ) where auth.uid() is not null;
$$;

create or replace function public.create_invitation(p_organization_id uuid, p_email text, p_role text default 'owner', p_valid_days integer default 7)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_board(p_organization_id);
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_token text;
  v_id uuid;
  v_expires timestamptz;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or length(v_email) > 320 then
    raise exception 'Neplatná e-mailová adresa.' using errcode = 'PT422';
  end if;
  if p_role is null or p_role not in ('owner', 'board', 'manager', 'technical') then
    raise exception 'Nepovolená role pozvánky.' using errcode = 'PT422';
  end if;
  if p_valid_days is null or p_valid_days not between 1 and 30 then
    raise exception 'Platnost pozvánky musí být 1 až 30 dní.' using errcode = 'PT422';
  end if;
  perform app.enforce_rate_limit('create_invitation', 50, interval '1 hour');

  update public.invitations set revoked_at = now(), revoked_by = v_uid
  where organization_id = p_organization_id and email = v_email and accepted_at is null and revoked_at is null;

  v_token := replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '');
  v_expires := now() + make_interval(days => p_valid_days);
  insert into public.invitations (organization_id, email, role, token_hash, expires_at, created_by)
  values (p_organization_id, v_email, p_role, encode(sha256(convert_to(v_token, 'UTF8')), 'hex'), v_expires, v_uid)
  returning id into v_id;

  return jsonb_build_object('invitation_id', v_id, 'token', v_token, 'expires_at', v_expires);
end $$;

create or replace function public.revoke_invitation(p_invitation_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_org uuid; v_uid uuid;
begin
  select organization_id into v_org from public.invitations where id = p_invitation_id;
  if v_org is null then
    raise exception 'Pozvánka nebyla nalezena.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_org);
  update public.invitations set revoked_at = now(), revoked_by = v_uid
  where id = p_invitation_id and accepted_at is null and revoked_at is null;
end $$;

create or replace function public.accept_invitation(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_email text;
  v_inv public.invitations%rowtype;
  v_membership public.memberships%rowtype;
begin
  perform app.enforce_rate_limit('accept_invitation', 10, interval '15 minutes');
  select lower(u.email) into v_email from auth.users u where u.id = v_uid and u.email_confirmed_at is not null;

  select * into v_inv from public.invitations i
  where i.token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'UTF8')), 'hex')
    and i.accepted_at is null and i.revoked_at is null and i.expires_at > now()
  for update;

  if v_email is null or v_inv.id is null or v_inv.email <> v_email then
    raise exception 'Pozvánka je neplatná, použitá nebo prošlá.' using errcode = 'PT404';
  end if;

  select * into v_membership from public.memberships
  where organization_id = v_inv.organization_id and user_id = v_uid for update;

  if v_membership.id is not null and v_membership.status = 'suspended' then
    raise exception 'Pozvánka je neplatná, použitá nebo prošlá.' using errcode = 'PT404';
  end if;

  if v_membership.id is null then
    insert into public.memberships (organization_id, user_id, status, invitation_id)
    values (v_inv.organization_id, v_uid, 'invited', v_inv.id)
    returning * into v_membership;
  elsif v_membership.status = 'ended' then
    update public.memberships set status = 'invited', invitation_id = v_inv.id, valid_to = null, approved_by = null, approved_at = null
    where id = v_membership.id returning * into v_membership;
  end if;

  insert into public.membership_roles (organization_id, membership_id, role, granted_by)
  values (v_inv.organization_id, v_membership.id, v_inv.role, v_inv.created_by)
  on conflict (membership_id, role) where revoked_at is null do nothing;

  update public.invitations set accepted_at = now(), accepted_by = v_uid where id = v_inv.id;

  return jsonb_build_object('membership_id', v_membership.id, 'organization_id', v_membership.organization_id, 'status', v_membership.status);
end $$;

create or replace function public.set_membership_status(p_membership_id uuid, p_status text, p_expected_row_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_m public.memberships%rowtype; v_uid uuid;
begin
  select * into v_m from public.memberships where id = p_membership_id for update;
  if v_m.id is null then
    raise exception 'Členství nebylo nalezeno.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_m.organization_id);
  if v_m.row_version <> p_expected_row_version then
    raise exception 'Záznam mezitím změnil někdo jiný. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if not (
    (v_m.status = 'invited' and p_status in ('active', 'ended')) or
    (v_m.status = 'active' and p_status in ('suspended', 'ended')) or
    (v_m.status = 'suspended' and p_status in ('active', 'ended'))
  ) then
    raise exception 'Přechod stavu členství % -> % není povolen.', v_m.status, p_status using errcode = 'PT422';
  end if;
  if v_m.status = 'active' and p_status <> 'active' and app.is_board_membership(v_m.id)
     and app.other_active_board_count(v_m.organization_id, v_m.id) = 0 then
    raise exception 'Nelze odebrat posledního aktivního člena výboru. Nejprve určete náhradu.' using errcode = 'PT409';
  end if;

  update public.memberships set
    status = p_status,
    approved_by = case when p_status = 'active' and v_m.status = 'invited' then v_uid else approved_by end,
    approved_at = case when p_status = 'active' and v_m.status = 'invited' then now() else approved_at end,
    valid_to = case when p_status = 'ended' then now() else valid_to end
  where id = p_membership_id
  returning row_version into v_m.row_version;
  return v_m.row_version;
end $$;

create or replace function public.grant_role(p_membership_id uuid, p_role text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m public.memberships%rowtype; v_uid uuid; v_id uuid;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if v_m.id is null then
    raise exception 'Členství nebylo nalezeno.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_m.organization_id);
  if p_role is null or p_role not in ('owner', 'board', 'manager', 'technical') then
    raise exception 'Tuto roli nelze přidělit z aplikace.' using errcode = 'PT403';
  end if;
  if v_m.status = 'ended' then
    raise exception 'Ukončenému členství nelze přidělit roli.' using errcode = 'PT422';
  end if;
  insert into public.membership_roles (organization_id, membership_id, role, granted_by)
  values (v_m.organization_id, v_m.id, p_role, v_uid)
  on conflict (membership_id, role) where revoked_at is null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.membership_roles where membership_id = v_m.id and role = p_role and revoked_at is null;
  end if;
  return v_id;
end $$;

create or replace function public.revoke_role(p_role_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_r public.membership_roles%rowtype; v_status text; v_uid uuid;
begin
  select * into v_r from public.membership_roles where id = p_role_id for update;
  if v_r.id is null or v_r.revoked_at is not null then
    raise exception 'Aktivní role nebyla nalezena.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_r.organization_id);
  if v_r.role = 'system_admin' then
    raise exception 'Technickou roli spravuje pouze provozní správce prostředí.' using errcode = 'PT403';
  end if;
  select status into v_status from public.memberships where id = v_r.membership_id;
  if v_r.role = 'board' and v_status = 'active'
     and app.other_active_board_count(v_r.organization_id, v_r.membership_id) = 0 then
    raise exception 'Nelze odebrat posledního aktivního člena výboru. Nejprve určete náhradu.' using errcode = 'PT409';
  end if;
  update public.membership_roles set revoked_at = now(), revoked_by = v_uid where id = p_role_id;
end $$;

create or replace function public.grant_scope(p_membership_id uuid, p_scope text, p_permission text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_m public.memberships%rowtype; v_uid uuid; v_id uuid;
begin
  select * into v_m from public.memberships where id = p_membership_id;
  if v_m.id is null then
    raise exception 'Členství nebylo nalezeno.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_m.organization_id);
  if p_scope is null or p_scope not in ('news', 'intents', 'forms', 'settings')
     or p_permission is null or p_permission not in ('read', 'write', 'approve') then
    raise exception 'Neplatný rozsah delegace.' using errcode = 'PT422';
  end if;
  if v_m.status = 'ended' then
    raise exception 'Ukončenému členství nelze delegovat oprávnění.' using errcode = 'PT422';
  end if;
  insert into public.scoped_grants (organization_id, membership_id, scope, permission, granted_by)
  values (v_m.organization_id, v_m.id, p_scope, p_permission, v_uid)
  on conflict (membership_id, scope, permission) where revoked_at is null do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.scoped_grants
    where membership_id = v_m.id and scope = p_scope and permission = p_permission and revoked_at is null;
  end if;
  return v_id;
end $$;

create or replace function public.revoke_scope(p_grant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_g public.scoped_grants%rowtype; v_uid uuid;
begin
  select * into v_g from public.scoped_grants where id = p_grant_id for update;
  if v_g.id is null or v_g.revoked_at is not null then
    raise exception 'Aktivní delegace nebyla nalezena.' using errcode = 'PT404';
  end if;
  v_uid := app.require_board(v_g.organization_id);
  update public.scoped_grants set revoked_at = now(), revoked_by = v_uid where id = p_grant_id;
end $$;

create or replace function public.list_members(p_organization_id uuid)
returns table (
  membership_id uuid, user_id uuid, email text, display_name text, status text, row_version integer,
  created_at timestamptz, approved_at timestamptz, roles jsonb, grants jsonb
) language plpgsql stable security definer set search_path = '' as $$
begin
  perform app.require_board(p_organization_id);
  return query
  select m.id, m.user_id, u.email::text, p.display_name, m.status, m.row_version, m.created_at, m.approved_at,
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'role', r.role) order by r.role)
              from public.membership_roles r where r.membership_id = m.id and r.revoked_at is null), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'scope', g.scope, 'permission', g.permission))
              from public.scoped_grants g where g.membership_id = m.id and g.revoked_at is null), '[]'::jsonb)
  from public.memberships m
  join auth.users u on u.id = m.user_id
  left join public.profiles p on p.user_id = m.user_id
  where m.organization_id = p_organization_id
  order by m.status, u.email;
end $$;

create or replace function app.bootstrap_first_board(p_organization_id uuid, p_user_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_membership_id uuid;
begin
  if p_reason is null or length(btrim(p_reason)) < 5 then
    raise exception 'Uveďte důvod bootstrapu.' using errcode = 'PT422';
  end if;
  if not exists (select 1 from public.organizations where id = p_organization_id) then
    raise exception 'Organizace neexistuje.' using errcode = 'PT404';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id and email_confirmed_at is not null) then
    raise exception 'Uživatel neexistuje nebo nemá ověřený e-mail.' using errcode = 'PT422';
  end if;
  if exists (
    select 1 from public.memberships m join public.membership_roles r on r.membership_id = m.id
    where m.organization_id = p_organization_id and m.status = 'active' and r.role = 'board' and r.revoked_at is null
  ) then
    raise exception 'Organizace už má aktivní výbor; další role přiděluje výbor v aplikaci.' using errcode = 'PT409';
  end if;

  insert into public.memberships (organization_id, user_id, status, approved_at)
  values (p_organization_id, p_user_id, 'active', now())
  on conflict (organization_id, user_id) do update set status = 'active', valid_to = null, approved_at = now()
  returning id into v_membership_id;

  insert into public.membership_roles (organization_id, membership_id, role)
  values (p_organization_id, v_membership_id, 'board')
  on conflict (membership_id, role) where revoked_at is null do nothing;

  perform app.log_event(p_organization_id, 'bootstrap_first_board', 'memberships', v_membership_id::text,
    jsonb_build_object('user_id', p_user_id, 'reason', p_reason, 'db_user', current_user));
  return v_membership_id;
end $$;

revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.is_active_member(uuid), app.has_role(uuid, text), app.has_grant(uuid, text, text),
  app.can_manage(uuid, text), app.can_approve(uuid, text) to anon, authenticated;

revoke execute on function public.my_context(), public.create_invitation(uuid, text, text, integer),
  public.revoke_invitation(uuid), public.accept_invitation(text), public.set_membership_status(uuid, text, integer),
  public.grant_role(uuid, text), public.revoke_role(uuid), public.grant_scope(uuid, text, text),
  public.revoke_scope(uuid), public.list_members(uuid) from public, anon;
grant execute on function public.my_context(), public.create_invitation(uuid, text, text, integer),
  public.revoke_invitation(uuid), public.accept_invitation(text), public.set_membership_status(uuid, text, integer),
  public.grant_role(uuid, text), public.revoke_role(uuid), public.grant_scope(uuid, text, text),
  public.revoke_scope(uuid), public.list_members(uuid) to authenticated;