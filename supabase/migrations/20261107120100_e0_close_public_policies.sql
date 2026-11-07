-- E0 / SEC-04, SEC-05: uzavření širokých veřejných politik z 20251228145052 (nálezy F01, F02, F07),
-- vazba stávajících dat na SVJ, chráněné sloupce, serverová validace a povolené přechody stavů.
-- Stávající řádky, ID a hodnoty se zachovávají. Neznámý autor historických záznamů zůstává NULL.

-- Pilotní SVJ pro backfill. Název je zástupný a doplní jej správce; nejde o ověřený údaj.
insert into public.organizations (id, name)
values ('00000000-0000-4000-8000-000000000001', 'Pilotní SVJ (název doplní správce)')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- 1. Výslovné odstranění širokých politik (nestačí přidat restriktivnější vedle USING(true)).
-- ---------------------------------------------------------------------------

drop policy if exists "Public read access for news" on public.news;
drop policy if exists "Public read access for intents" on public.intents;
drop policy if exists "Public read access for forms" on public.forms;
drop policy if exists "Public read access for settings" on public.settings;
drop policy if exists "Public insert for form_submissions" on public.form_submissions;
drop policy if exists "Public insert for intents" on public.intents;

revoke all on public.news, public.intents, public.forms, public.form_submissions, public.settings from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Nové sloupce, backfill a zúžení nullability
-- ---------------------------------------------------------------------------

alter table public.news
  add column organization_id uuid references public.organizations (id),
  add column visibility text not null default 'owners' check (visibility in ('public', 'owners', 'board')),
  add column created_by uuid references auth.users (id) on delete set null,
  add column updated_by uuid references auth.users (id) on delete set null,
  add column row_version integer not null default 1;
update public.news set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.news set status = 'draft' where status is null;
-- Dosud veřejně zobrazované publikované novinky zůstávají veřejné; koncepty jsou interní.
update public.news set visibility = case when status = 'published' then 'public' else 'owners' end;
alter table public.news
  alter column organization_id set not null,
  alter column status set not null,
  alter column status set default 'draft';
create index news_org_idx on public.news (organization_id, status, visibility);

alter table public.intents
  add column organization_id uuid references public.organizations (id),
  add column created_by uuid references auth.users (id) on delete set null,
  add column updated_by uuid references auth.users (id) on delete set null,
  add column row_version integer not null default 1;
update public.intents set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.intents set status = 'navrh' where status is null;
update public.intents set priority = 'medium' where priority is null;
alter table public.intents
  alter column organization_id set not null,
  alter column status set not null,
  alter column priority set not null;
create index intents_org_idx on public.intents (organization_id, status);

alter table public.forms
  add column organization_id uuid references public.organizations (id),
  add column updated_at timestamptz not null default now();
update public.forms set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
update public.forms set active = false where active is null;
update public.forms set submit_target = 'feedback' where submit_target is null;
update public.forms set fields = '[]'::jsonb where fields is null;
alter table public.forms
  alter column organization_id set not null,
  alter column active set not null,
  alter column submit_target set not null,
  alter column fields set not null,
  add constraint forms_org_id_uniq unique (organization_id, id);

alter table public.form_submissions
  add column organization_id uuid,
  add column submitted_by uuid references auth.users (id) on delete set null;
update public.form_submissions s set organization_id = f.organization_id from public.forms f where f.id = s.form_id;
update public.form_submissions set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
alter table public.form_submissions
  alter column organization_id set not null,
  add constraint form_submissions_org_fk foreign key (organization_id) references public.organizations (id),
  -- Podání nesmí odkazovat na formulář jiného SVJ.
  add constraint form_submissions_form_same_org_fk foreign key (organization_id, form_id)
    references public.forms (organization_id, id) on delete cascade;
create index form_submissions_org_idx on public.form_submissions (organization_id, created_at desc);
create index form_submissions_author_idx on public.form_submissions (submitted_by);

alter table public.settings
  add column organization_id uuid references public.organizations (id),
  add column is_public boolean not null default false,
  add column updated_by uuid references auth.users (id) on delete set null;
update public.settings set organization_id = '00000000-0000-4000-8000-000000000001' where organization_id is null;
-- Úvodní text byl dosud zobrazován veřejně; ostatní klíče jsou interní, dokud je výbor nezveřejní.
update public.settings set is_public = true where key = 'intro_text';
alter table public.settings alter column organization_id set not null;

-- ---------------------------------------------------------------------------
-- 3. Validace definic formulářů
-- ---------------------------------------------------------------------------

create or replace function app.valid_form_fields(p_fields jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select jsonb_typeof(p_fields) = 'array'
    and jsonb_array_length(p_fields) <= 50
    and not exists (
      select 1 from jsonb_array_elements(p_fields) f
      where jsonb_typeof(f) <> 'object'
         or coalesce(f ->> 'name', '') !~ '^[a-z][a-z0-9_]{0,49}$'
         or length(coalesce(f ->> 'label', '')) not between 1 and 200
         or coalesce(f ->> 'type', '') not in ('text', 'textarea', 'number')
         or jsonb_typeof(f -> 'required') is distinct from 'boolean'
    )
    and (select count(distinct f ->> 'name') = count(*) from jsonb_array_elements(p_fields) f);
$$;
-- NOT VALID: vynucuje se u nových a měněných řádků; stávající formuláře s neznámou strukturou migraci neblokují.
-- Po ruční kontrole existujících formulářů lze doplnit: alter table public.forms validate constraint forms_fields_valid;
alter table public.forms add constraint forms_fields_valid check (app.valid_form_fields(fields)) not valid;

-- ---------------------------------------------------------------------------
-- 4. Triggery: autor, updated_at/updated_by, row_version, neměnné sloupce, audit
-- ---------------------------------------------------------------------------

create or replace function app.set_created_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

create or replace function app.set_updated_by()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_by := auth.uid();
  return new;
end $$;

create trigger news_created_by before insert on public.news for each row execute function app.set_created_by();
create trigger news_updated_at before update on public.news for each row execute function app.set_updated_at();
create trigger news_updated_by before update on public.news for each row execute function app.set_updated_by();
create trigger news_row_version before update on public.news for each row execute function app.bump_row_version();
create trigger news_protect before update on public.news for each row execute function app.protect_columns('id', 'organization_id', 'created_by', 'created_at');
create trigger news_audit after insert or update or delete on public.news for each row execute function app.audit_row('content', 'perex');

create trigger intents_updated_at before update on public.intents for each row execute function app.set_updated_at();
create trigger intents_updated_by before update on public.intents for each row execute function app.set_updated_by();
create trigger intents_row_version before update on public.intents for each row execute function app.bump_row_version();
create trigger intents_protect before update on public.intents for each row execute function app.protect_columns('id', 'organization_id', 'created_by', 'created_at', 'proposer_name');
create trigger intents_audit after insert or update or delete on public.intents for each row execute function app.audit_row('description');

create trigger forms_updated_at before update on public.forms for each row execute function app.set_updated_at();
create trigger forms_protect before update on public.forms for each row execute function app.protect_columns('id', 'organization_id', 'created_at');
create trigger forms_audit after insert or update or delete on public.forms for each row execute function app.audit_row();

create trigger form_submissions_protect before update on public.form_submissions for each row execute function app.protect_columns('id', 'organization_id', 'form_id', 'submitted_by', 'created_at', 'data');
create trigger form_submissions_audit after insert or delete on public.form_submissions for each row execute function app.audit_row('data');

create trigger settings_updated_at before update on public.settings for each row execute function app.set_updated_at();
create trigger settings_updated_by before update on public.settings for each row execute function app.set_updated_by();
create trigger settings_protect before update on public.settings for each row execute function app.protect_columns('id', 'organization_id', 'key');
create trigger settings_audit after insert or update or delete on public.settings for each row execute function app.audit_row();

-- Publikace novinky (nebo změna viditelnosti publikované novinky) vyžaduje schvalovací oprávnění.
create or replace function app.news_publication_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if auth.uid() is null then
    return new; -- provozní zásah bez uživatelského JWT (service role / SQL editor)
  end if;
  if new.status = 'published' and (
       tg_op = 'INSERT' or old.status is distinct from 'published' or old.visibility is distinct from new.visibility
     ) and not app.can_approve(new.organization_id, 'news') then
    raise exception 'Publikace novinky vyžaduje schvalovací oprávnění.' using errcode = 'PT403';
  end if;
  return new;
end $$;
create trigger news_publication_guard before insert or update on public.news
  for each row execute function app.news_publication_guard();

-- Povolené přechody záměrů; schválení (-> schvaleno) jen board nebo delegace approve.
create or replace function app.intent_status_guard()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;
  if not (
    (old.status = 'navrh' and new.status in ('projednava-se')) or
    (old.status = 'projednava-se' and new.status in ('navrh', 'schvaleno')) or
    (old.status = 'schvaleno' and new.status in ('projednava-se', 'realizace')) or
    (old.status = 'realizace' and new.status in ('schvaleno', 'hotovo')) or
    (old.status = 'hotovo' and new.status in ('realizace'))
  ) then
    raise exception 'Přechod stavu záměru % -> % není povolen.', old.status, new.status using errcode = 'PT422';
  end if;
  if new.status = 'schvaleno' and auth.uid() is not null and not app.can_approve(new.organization_id, 'intents') then
    raise exception 'Schválení záměru vyžaduje schvalovací oprávnění.' using errcode = 'PT403';
  end if;
  return new;
end $$;
create trigger intents_status_guard before update on public.intents
  for each row execute function app.intent_status_guard();

-- ---------------------------------------------------------------------------
-- 5. RLS politiky a granty po sloupcích
-- ---------------------------------------------------------------------------

-- news: veřejnost jen visibility=public AND status=published.
grant select on public.news to anon, authenticated;
grant insert (organization_id, title, perex, content, image, author, tags, published_at, pinned, status, visibility),
  update (title, perex, content, image, author, tags, published_at, pinned, status, visibility),
  delete on public.news to authenticated;

create policy news_public_read on public.news for select to anon, authenticated
  using (status = 'published' and visibility = 'public');
create policy news_member_read on public.news for select to authenticated
  using (status = 'published' and visibility in ('public', 'owners') and app.is_active_member(organization_id));
create policy news_manager_read on public.news for select to authenticated
  using (app.can_manage(organization_id, 'news'));
create policy news_manager_insert on public.news for insert to authenticated
  with check (app.can_manage(organization_id, 'news'));
create policy news_manager_update on public.news for update to authenticated
  using (app.can_manage(organization_id, 'news')) with check (app.can_manage(organization_id, 'news'));
create policy news_board_delete on public.news for delete to authenticated
  using (app.has_role(organization_id, 'board'));

-- intents: jen aktivní členové; vložení přes submit_intent, stav přes change_intent_status.
grant select on public.intents to authenticated;
grant update (title, description, priority) on public.intents to authenticated;
grant delete on public.intents to authenticated;

create policy intents_member_read on public.intents for select to authenticated
  using (app.is_active_member(organization_id));
create policy intents_manager_update on public.intents for update to authenticated
  using (app.can_manage(organization_id, 'intents')) with check (app.can_manage(organization_id, 'intents'));
create policy intents_board_delete on public.intents for delete to authenticated
  using (app.has_role(organization_id, 'board'));

-- forms: aktivní formuláře pro aktivní členy, vše pro správce formulářů.
grant select on public.forms to authenticated;
grant insert (organization_id, title, description, fields, submit_target, active),
  update (title, description, fields, submit_target, active),
  delete on public.forms to authenticated;

create policy forms_member_read on public.forms for select to authenticated
  using (active and app.is_active_member(organization_id));
create policy forms_manager_read on public.forms for select to authenticated
  using (app.can_manage(organization_id, 'forms'));
create policy forms_manager_insert on public.forms for insert to authenticated
  with check (app.can_manage(organization_id, 'forms'));
create policy forms_manager_update on public.forms for update to authenticated
  using (app.can_manage(organization_id, 'forms')) with check (app.can_manage(organization_id, 'forms'));
create policy forms_board_delete on public.forms for delete to authenticated
  using (app.has_role(organization_id, 'board'));

-- form_submissions: vložení jen přes submit_form; čte autor (aktivní člen) a board / delegace forms:read.
grant select on public.form_submissions to authenticated;

create policy form_submissions_author_read on public.form_submissions for select to authenticated
  using (submitted_by = auth.uid() and app.is_active_member(organization_id));
create policy form_submissions_board_read on public.form_submissions for select to authenticated
  using (app.has_role(organization_id, 'board') or app.has_grant(organization_id, 'forms', 'read'));

-- settings: veřejné jen is_public; interní jen správci nastavení.
grant select on public.settings to anon, authenticated;
grant insert (organization_id, key, value, is_public), update (value, is_public), delete on public.settings to authenticated;

create policy settings_public_read on public.settings for select to anon, authenticated
  using (is_public);
create policy settings_manager_read on public.settings for select to authenticated
  using (app.can_manage(organization_id, 'settings'));
create policy settings_manager_insert on public.settings for insert to authenticated
  with check (app.can_manage(organization_id, 'settings'));
create policy settings_manager_update on public.settings for update to authenticated
  using (app.can_manage(organization_id, 'settings')) with check (app.can_manage(organization_id, 'settings'));
create policy settings_board_delete on public.settings for delete to authenticated
  using (app.has_role(organization_id, 'board'));

-- ---------------------------------------------------------------------------
-- 6. Doménová RPC se serverovou validací
-- ---------------------------------------------------------------------------

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

  -- Stav a priorita jsou vždy výchozí; volající je nemůže nastavit.
  insert into public.intents (organization_id, title, description, proposer_name, status, priority, created_by)
  values (p_organization_id, v_title, nullif(v_description, ''), v_proposer, 'navrh', 'medium', v_uid)
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.change_intent_status(p_intent_id uuid, p_status text, p_expected_row_version integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare v_i public.intents%rowtype; v_new_version integer;
begin
  perform app.require_user();
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
  update public.intents set status = p_status where id = p_intent_id returning row_version into v_new_version;
  return v_new_version;
end $$;

create or replace function public.submit_form(p_form_id uuid, p_data jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := app.require_user();
  v_form public.forms%rowtype;
  v_field jsonb;
  v_key text;
  v_value jsonb;
  v_text text;
  v_clean jsonb := '{}'::jsonb;
  v_id uuid;
begin
  select * into v_form from public.forms where id = p_form_id;
  -- Neaktivní formulář nebo formulář jiného SVJ se tváří jako neexistující.
  if v_form.id is null or not v_form.active or not app.is_active_member(v_form.organization_id) then
    raise exception 'Formulář nebyl nalezen.' using errcode = 'PT404';
  end if;
  if v_form.submit_target = 'intent' then
    raise exception 'Tento formulář se odesílá jako záměr.' using errcode = 'PT422';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Data formuláře musí být objekt.' using errcode = 'PT422';
  end if;

  for v_key in select jsonb_object_keys(p_data) loop
    if not exists (select 1 from jsonb_array_elements(v_form.fields) f where f ->> 'name' = v_key) then
      raise exception 'Pole "%" formulář neobsahuje.', left(v_key, 50) using errcode = 'PT422';
    end if;
  end loop;

  for v_field in select * from jsonb_array_elements(v_form.fields) loop
    v_value := p_data -> (v_field ->> 'name');
    if v_value is not null and jsonb_typeof(v_value) not in ('string', 'null') then
      raise exception 'Pole "%" musí být text.', v_field ->> 'label' using errcode = 'PT422';
    end if;
    v_text := btrim(coalesce(v_value #>> '{}', ''));
    if (v_field ->> 'required')::boolean and v_text = '' then
      raise exception 'Pole "%" je povinné.', v_field ->> 'label' using errcode = 'PT422';
    end if;
    if v_text <> '' then
      if v_field ->> 'type' = 'number' and v_text !~ '^-?[0-9]{1,9}([.,][0-9]{1,4})?$' then
        raise exception 'Pole "%" musí být číslo.', v_field ->> 'label' using errcode = 'PT422';
      end if;
      if length(v_text) > (case when v_field ->> 'type' = 'textarea' then 5000 else 500 end) then
        raise exception 'Pole "%" je příliš dlouhé.', v_field ->> 'label' using errcode = 'PT422';
      end if;
      v_clean := v_clean || jsonb_build_object(v_field ->> 'name', v_text);
    end if;
  end loop;

  if v_form.submit_target = 'survey' and v_clean ? 'rating'
     and exists (select 1 from jsonb_array_elements(v_form.fields) f where f ->> 'name' = 'rating' and f ->> 'type' = 'number')
     and replace(v_clean ->> 'rating', ',', '.')::numeric not between 1 and 5 then
    raise exception 'Hodnocení musí být v rozsahu 1 až 5.' using errcode = 'PT422';
  end if;

  perform app.enforce_rate_limit('submit_form', 20, interval '1 hour');
  insert into public.form_submissions (organization_id, form_id, data, submitted_by)
  values (v_form.organization_id, v_form.id, v_clean, v_uid)
  returning id into v_id;
  return v_id;
end $$;

-- valid_form_fields je v CHECK omezení a vyhodnocuje se s právy volajícího; je čistá a bez přístupu k datům.
revoke execute on function app.valid_form_fields(jsonb) from public, anon;
grant execute on function app.valid_form_fields(jsonb) to authenticated;
revoke execute on function app.set_created_by(), app.set_updated_by(),
  app.news_publication_guard(), app.intent_status_guard() from public, anon, authenticated;
revoke execute on function public.submit_intent(uuid, text, text, text), public.change_intent_status(uuid, text, integer),
  public.submit_form(uuid, jsonb) from public, anon;
grant execute on function public.submit_intent(uuid, text, text, text), public.change_intent_status(uuid, text, integer),
  public.submit_form(uuid, jsonb) to authenticated;
