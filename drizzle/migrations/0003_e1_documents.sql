create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id),
  title text not null check (length(title) between 3 and 200),
  category text not null check (category in ('stanovy', 'zapisy', 'smlouvy', 'technicka', 'revize', 'opravy', 'finance', 'ostatni')),
  period_from date,
  period_to date,
  visibility text not null default 'board' check (visibility in ('owners', 'board', 'restricted')),
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'published', 'archived', 'withdrawn')),
  current_version_id uuid,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  row_version integer not null default 1,
  unique (organization_id, id),
  check (period_to is null or period_from is null or period_to >= period_from)
);
create index documents_org_idx on public.documents (organization_id, lifecycle, category);

create table public.document_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  version_no integer not null check (version_no > 0),
  object_key text not null unique,
  original_filename text not null check (length(original_filename) between 1 and 255),
  mime_type text not null,
  bytes bigint not null check (bytes > 0 and bytes <= 26214400),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  upload_status text not null default 'pending' check (upload_status in ('pending', 'ready', 'failed')),
  failure_reason text,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  unique (document_id, version_no),
  unique (document_id, id),
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);

alter table public.documents
  add constraint documents_current_version_fk foreign key (id, current_version_id)
  references public.document_versions (document_id, id) deferrable initially deferred;

create table public.document_grants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  document_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  permission text not null check (permission in ('read', 'manage')),
  granted_by uuid references auth.users (id) on delete set null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users (id) on delete set null,
  foreign key (organization_id, document_id) references public.documents (organization_id, id) on delete cascade
);
create unique index document_grants_active_uniq on public.document_grants (document_id, user_id, permission) where revoked_at is null;
create index document_grants_user_idx on public.document_grants (user_id) where revoked_at is null;

create or replace function app.has_doc_grant(p_doc uuid, p_manage_only boolean)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_grants g
    where g.document_id = p_doc and g.user_id = auth.uid() and g.revoked_at is null
      and (not p_manage_only or g.permission = 'manage')
  );
$$;

create or replace function app.can_manage_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc and app.is_active_member(d.organization_id)
      and ((d.visibility <> 'restricted' and app.has_role(d.organization_id, 'board')) or app.has_doc_grant(d.id, true))
  );
$$;

create or replace function app.can_read_document(p_doc uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documents d
    where d.id = p_doc and app.is_active_member(d.organization_id)
      and (
        app.can_manage_document(d.id)
        or (d.lifecycle in ('published', 'archived') and (
              d.visibility = 'owners'
              or (d.visibility = 'board' and app.has_role(d.organization_id, 'board'))
              or app.has_doc_grant(d.id, false)
        ))
      )
  );
$$;

create or replace function app.can_read_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
    where v.object_key = p_name
      and ((v.upload_status = 'ready' and app.can_read_document(v.document_id)) or app.can_manage_document(v.document_id))
  );
$$;

create or replace function app.can_upload_object(p_name text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.document_versions v
    where v.object_key = p_name and v.upload_status = 'pending' and v.uploaded_by = auth.uid()
      and v.created_at > now() - interval '1 hour' and app.can_manage_document(v.document_id)
  );
$$;

create or replace function app.allowed_mime(p_ext text)
returns text language sql immutable set search_path = '' as $$
  select case lower(p_ext)
    when 'pdf' then 'application/pdf'
    when 'docx' then 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    when 'xlsx' then 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    when 'png' then 'image/png'
    when 'jpg' then 'image/jpeg'
    when 'jpeg' then 'image/jpeg'
  end;
$$;

create trigger documents_updated_at before update on public.documents for each row execute function app.set_updated_at();
create trigger documents_row_version before update on public.documents for each row execute function app.bump_row_version();
create trigger documents_protect before update on public.documents for each row execute function app.protect_columns('id', 'organization_id', 'created_by', 'created_at');
create trigger documents_audit after insert or update or delete on public.documents for each row execute function app.audit_row();

create trigger document_versions_protect before update on public.document_versions
  for each row execute function app.protect_columns('id', 'organization_id', 'document_id', 'version_no', 'object_key', 'original_filename', 'mime_type', 'bytes', 'sha256', 'uploaded_by', 'created_at');
create trigger document_versions_audit after insert or update or delete on public.document_versions for each row execute function app.audit_row();

create trigger document_grants_protect before update on public.document_grants
  for each row execute function app.protect_columns('id', 'organization_id', 'document_id', 'user_id', 'permission', 'granted_by', 'granted_at');
create trigger document_grants_audit after insert or update or delete on public.document_grants for each row execute function app.audit_row();

create or replace function app.document_version_status_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.upload_status is distinct from old.upload_status and not (old.upload_status = 'pending' and new.upload_status in ('ready', 'failed')) then
    raise exception 'Stav verze % -> % není povolen.', old.upload_status, new.upload_status using errcode = 'PT422';
  end if;
  return new;
end $$;
create trigger document_versions_status_guard before update on public.document_versions for each row execute function app.document_version_status_guard();

alter table public.documents enable row level security;
alter table public.document_versions enable row level security;
alter table public.document_grants enable row level security;
revoke all on public.documents, public.document_versions, public.document_grants from anon, authenticated;
grant select on public.documents, public.document_versions, public.document_grants to authenticated;

create policy documents_read on public.documents for select to authenticated using (app.can_read_document(id));
create policy document_versions_read on public.document_versions for select to authenticated
  using ((upload_status = 'ready' and app.can_read_document(document_id)) or app.can_manage_document(document_id));
create policy document_grants_read on public.document_grants for select to authenticated
  using (app.can_manage_document(document_id) or user_id = auth.uid());

create policy documents_objects_read on storage.objects for select to authenticated
  using (bucket_id = 'documents' and app.can_read_object(name));
create policy documents_objects_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and app.can_upload_object(name));

create or replace function app.validate_document_fields(p_title text, p_category text, p_from date, p_to date, p_visibility text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if length(btrim(coalesce(p_title, ''))) not between 3 and 200 then
    raise exception 'Název musí mít 3 až 200 znaků.' using errcode = 'PT422';
  end if;
  if p_category is null or p_category not in ('stanovy', 'zapisy', 'smlouvy', 'technicka', 'revize', 'opravy', 'finance', 'ostatni') then
    raise exception 'Neplatná kategorie.' using errcode = 'PT422';
  end if;
  if p_visibility is null or p_visibility not in ('owners', 'board', 'restricted') then
    raise exception 'Neplatné publikum.' using errcode = 'PT422';
  end if;
  if p_from is not null and p_to is not null and p_to < p_from then
    raise exception 'Konec období je před začátkem.' using errcode = 'PT422';
  end if;
end $$;

create or replace function public.create_document(
  p_organization_id uuid, p_title text, p_category text, p_period_from date, p_period_to date, p_visibility text
) returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_board(p_organization_id); v_id uuid;
begin
  perform app.validate_document_fields(p_title, p_category, p_period_from, p_period_to, p_visibility);
  perform app.enforce_rate_limit('create_document', 60, interval '1 hour');
  insert into public.documents (organization_id, title, category, period_from, period_to, visibility, created_by)
  values (p_organization_id, btrim(p_title), p_category, p_period_from, p_period_to, p_visibility, v_uid)
  returning id into v_id;
  if p_visibility = 'restricted' then
    insert into public.document_grants (organization_id, document_id, user_id, permission, granted_by)
    values (p_organization_id, v_id, v_uid, 'manage', v_uid);
  end if;
  return v_id;
end $$;

create or replace function public.update_document(
  p_document_id uuid, p_title text, p_category text, p_period_from date, p_period_to date, p_visibility text, p_expected_row_version integer
) returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_d public.documents%rowtype; v_version integer;
begin
  select * into v_d from public.documents where id = p_document_id for update;
  if v_d.id is null or not app.can_manage_document(v_d.id) then
    raise exception 'Dokument nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_d.row_version <> p_expected_row_version then
    raise exception 'Dokument mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  perform app.validate_document_fields(p_title, p_category, p_period_from, p_period_to, p_visibility);
  if p_visibility = 'restricted' and v_d.visibility <> 'restricted' and not app.has_doc_grant(v_d.id, true) then
    insert into public.document_grants (organization_id, document_id, user_id, permission, granted_by)
    values (v_d.organization_id, v_d.id, v_uid, 'manage', v_uid) on conflict do nothing;
  end if;
  update public.documents set title = btrim(p_title), category = p_category, period_from = p_period_from,
    period_to = p_period_to, visibility = p_visibility where id = v_d.id
  returning row_version into v_version;
  return v_version;
end $$;

create or replace function public.begin_upload(p_document_id uuid, p_filename text, p_mime text, p_bytes bigint, p_sha256 text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_d public.documents%rowtype;
  v_name text := btrim(coalesce(p_filename, ''));
  v_ext text;
  v_no integer;
  v_id uuid := gen_random_uuid();
  v_key text;
begin
  select * into v_d from public.documents where id = p_document_id for update;
  if v_d.id is null or not app.can_manage_document(v_d.id) then
    raise exception 'Dokument nebyl nalezen.' using errcode = 'PT404';
  end if;
  if length(v_name) not between 1 and 255 or v_name ~ '[/\\\x00-\x1f]' or position('..' in v_name) > 0 then
    raise exception 'Neplatný název souboru.' using errcode = 'PT422';
  end if;
  v_ext := lower(substring(v_name from '\.([A-Za-z0-9]+)$'));
  if v_ext is null or app.allowed_mime(v_ext) is null or app.allowed_mime(v_ext) is distinct from p_mime then
    raise exception 'Nepodporovaný typ souboru. Povoleno: PDF, DOCX, XLSX, PNG, JPG.' using errcode = 'PT422';
  end if;
  if p_bytes is null or p_bytes <= 0 or p_bytes > 26214400 then
    raise exception 'Soubor musí mít 1 bajt až 25 MB.' using errcode = 'PT422';
  end if;
  if p_sha256 is null or p_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'Neplatný kontrolní součet.' using errcode = 'PT422';
  end if;
  perform app.enforce_rate_limit('begin_upload', 60, interval '1 hour');

  update public.document_versions set upload_status = 'failed', failure_reason = 'nedokončeno do 1 hodiny'
  where document_id = v_d.id and upload_status = 'pending' and created_at <= now() - interval '1 hour';

  select coalesce(max(version_no), 0) + 1 into v_no from public.document_versions where document_id = v_d.id;
  v_key := v_d.organization_id::text || '/' || v_d.id::text || '/' || v_id::text;
  insert into public.document_versions (id, organization_id, document_id, version_no, object_key, original_filename, mime_type, bytes, sha256, uploaded_by)
  values (v_id, v_d.organization_id, v_d.id, v_no, v_key, v_name, p_mime, p_bytes, p_sha256, v_uid);
  return jsonb_build_object('version_id', v_id, 'version_no', v_no, 'object_key', v_key);
end $$;

create or replace function public.complete_upload(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_v public.document_versions%rowtype;
  v_size bigint;
  v_mime text;
  v_found boolean;
begin
  perform app.require_user();
  select * into v_v from public.document_versions where id = p_version_id for update;
  if v_v.id is null or not app.can_manage_document(v_v.document_id) then
    raise exception 'Verze nebyla nalezena.' using errcode = 'PT404';
  end if;
  if v_v.upload_status = 'ready' then
    return jsonb_build_object('status', 'ready', 'version_no', v_v.version_no);
  end if;
  if v_v.upload_status = 'failed' then
    raise exception 'Nahrávání selhalo. Nahrajte soubor znovu.' using errcode = 'PT409';
  end if;

  select true, nullif(o.metadata ->> 'size', '')::bigint, o.metadata ->> 'mimetype'
    into v_found, v_size, v_mime
  from storage.objects o where o.bucket_id = 'documents' and o.name = v_v.object_key;
  if v_found is not true then
    raise exception 'Soubor se na server nenahrál. Zkuste nahrání zopakovat.' using errcode = 'PT409';
  end if;
  if v_size is distinct from v_v.bytes or v_mime is distinct from v_v.mime_type then
    update public.document_versions set upload_status = 'failed', failure_reason = 'velikost nebo typ neodpovídá' where id = v_v.id;
    return jsonb_build_object('status', 'failed', 'reason', 'Velikost nebo typ nahraného souboru neodpovídá deklaraci.');
  end if;
  update public.document_versions set upload_status = 'ready', ready_at = now() where id = v_v.id;
  return jsonb_build_object('status', 'ready', 'version_no', v_v.version_no);
end $$;

create or replace function public.publish_version(p_document_id uuid, p_version_id uuid, p_expected_row_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_d public.documents%rowtype; v_status text; v_version integer;
begin
  perform app.require_user();
  select * into v_d from public.documents where id = p_document_id for update;
  if v_d.id is null or not app.can_manage_document(v_d.id) then
    raise exception 'Dokument nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_d.row_version <> p_expected_row_version then
    raise exception 'Dokument mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  select upload_status into v_status from public.document_versions where id = p_version_id and document_id = v_d.id;
  if v_status is distinct from 'ready' then
    raise exception 'Publikovat lze jen dokončenou verzi tohoto dokumentu.' using errcode = 'PT422';
  end if;
  if v_d.lifecycle = 'archived' then
    raise exception 'Archivovaný dokument nejprve obnovte.' using errcode = 'PT422';
  end if;
  update public.documents set current_version_id = p_version_id, lifecycle = 'published' where id = v_d.id
  returning row_version into v_version;
  return v_version;
end $$;

create or replace function public.set_document_lifecycle(p_document_id uuid, p_to text, p_expected_row_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_d public.documents%rowtype; v_version integer;
begin
  perform app.require_user();
  select * into v_d from public.documents where id = p_document_id for update;
  if v_d.id is null or not app.can_manage_document(v_d.id) then
    raise exception 'Dokument nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_d.row_version <> p_expected_row_version then
    raise exception 'Dokument mezitím někdo změnil. Načtěte jej znovu.' using errcode = 'PT409';
  end if;
  if not ((v_d.lifecycle, p_to) in (('published', 'archived'), ('published', 'withdrawn'), ('archived', 'published'), ('withdrawn', 'published'))) then
    raise exception 'Přechod % -> % není povolen.', v_d.lifecycle, coalesce(p_to, 'NULL') using errcode = 'PT422';
  end if;
  if p_to = 'published' and v_d.current_version_id is null then
    raise exception 'Dokument nemá publikovanou verzi.' using errcode = 'PT422';
  end if;
  update public.documents set lifecycle = p_to where id = v_d.id returning row_version into v_version;
  return v_version;
end $$;

create or replace function public.grant_document_access(p_document_id uuid, p_user_id uuid, p_permission text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_d public.documents%rowtype; v_id uuid;
begin
  select * into v_d from public.documents where id = p_document_id;
  if v_d.id is null or not app.can_manage_document(v_d.id) then
    raise exception 'Dokument nebyl nalezen.' using errcode = 'PT404';
  end if;
  if p_permission is null or p_permission not in ('read', 'manage') then
    raise exception 'Neplatné oprávnění.' using errcode = 'PT422';
  end if;
  if not exists (
    select 1 from public.memberships m where m.organization_id = v_d.organization_id and m.user_id = p_user_id
      and m.status = 'active' and (m.valid_to is null or m.valid_to > now())
  ) then
    raise exception 'Oprávnění lze udělit jen aktivnímu členu SVJ.' using errcode = 'PT422';
  end if;
  insert into public.document_grants (organization_id, document_id, user_id, permission, granted_by)
  values (v_d.organization_id, v_d.id, p_user_id, p_permission, v_uid)
  on conflict (document_id, user_id, permission) where revoked_at is null do nothing returning id into v_id;
  if v_id is null then
    select id into v_id from public.document_grants where document_id = v_d.id and user_id = p_user_id and permission = p_permission and revoked_at is null;
  end if;
  return v_id;
end $$;

create or replace function public.revoke_document_access(p_grant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := app.require_user(); v_g public.document_grants%rowtype; v_other integer;
begin
  select * into v_g from public.document_grants where id = p_grant_id for update;
  if v_g.id is null or v_g.revoked_at is not null or not app.can_manage_document(v_g.document_id) then
    raise exception 'Oprávnění nebylo nalezeno.' using errcode = 'PT404';
  end if;
  if v_g.permission = 'manage' and exists (select 1 from public.documents d where d.id = v_g.document_id and d.visibility = 'restricted') then
    select count(*) into v_other from public.document_grants
    where document_id = v_g.document_id and permission = 'manage' and revoked_at is null and id <> v_g.id;
    if v_other = 0 then
      raise exception 'Nelze odebrat posledního správce omezeného dokumentu.' using errcode = 'PT409';
    end if;
  end if;
  update public.document_grants set revoked_at = now(), revoked_by = v_uid where id = v_g.id;
end $$;

create or replace function public.authorize_download(p_version_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_v public.document_versions%rowtype;
begin
  perform app.require_user();
  select * into v_v from public.document_versions where id = p_version_id;
  if v_v.id is null or v_v.upload_status <> 'ready' or not app.can_read_document(v_v.document_id) then
    raise exception 'Soubor nebyl nalezen.' using errcode = 'PT404';
  end if;
  perform app.enforce_rate_limit('authorize_download', 200, interval '1 hour');
  perform app.log_event(v_v.organization_id, 'download', 'document_versions', v_v.id::text,
    jsonb_build_object('document_id', v_v.document_id, 'version_no', v_v.version_no));
  return jsonb_build_object('object_key', v_v.object_key, 'filename', v_v.original_filename, 'mime_type', v_v.mime_type);
end $$;

revoke execute on function app.has_doc_grant(uuid, boolean), app.can_manage_document(uuid), app.can_read_document(uuid),
  app.can_read_object(text), app.can_upload_object(text), app.allowed_mime(text), app.document_version_status_guard(),
  app.validate_document_fields(text, text, date, date, text) from public, anon;
grant execute on function app.has_doc_grant(uuid, boolean), app.can_manage_document(uuid), app.can_read_document(uuid),
  app.can_read_object(text), app.can_upload_object(text) to authenticated;

revoke execute on function public.create_document(uuid, text, text, date, date, text),
  public.update_document(uuid, text, text, date, date, text, integer),
  public.begin_upload(uuid, text, text, bigint, text), public.complete_upload(uuid),
  public.publish_version(uuid, uuid, integer), public.set_document_lifecycle(uuid, text, integer),
  public.grant_document_access(uuid, uuid, text), public.revoke_document_access(uuid),
  public.authorize_download(uuid) from public, anon;
grant execute on function public.create_document(uuid, text, text, date, date, text),
  public.update_document(uuid, text, text, date, date, text, integer),
  public.begin_upload(uuid, text, text, bigint, text), public.complete_upload(uuid),
  public.publish_version(uuid, uuid, integer), public.set_document_lifecycle(uuid, text, integer),
  public.grant_document_access(uuid, uuid, text), public.revoke_document_access(uuid),
  public.authorize_download(uuid) to authenticated;