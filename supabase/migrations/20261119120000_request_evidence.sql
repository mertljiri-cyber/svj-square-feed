-- Vazba na neměnnou verzi dokumentu. Práva k požadavku a dokumentu zůstávají oddělená.
create table public.request_evidence (
  request_id uuid not null,
  organization_id uuid not null,
  document_id uuid not null,
  version_id uuid not null,
  linked_at timestamptz not null default now(),
  primary key (request_id, version_id),
  foreign key (organization_id, request_id) references public.requests (organization_id, id),
  foreign key (organization_id, document_id) references public.documents (organization_id, id),
  foreign key (document_id, version_id) references public.document_versions (document_id, id)
);
create index request_evidence_document_idx on public.request_evidence (document_id, version_id);
alter table public.request_evidence enable row level security;
revoke all on public.request_evidence from public, anon, authenticated;
grant select on public.request_evidence to authenticated;

create policy request_evidence_read on public.request_evidence for select to authenticated
using (
  exists (select 1 from public.requests r where r.id = request_evidence.request_id)
  and app.can_read_document(document_id)
);

create or replace function public.attach_request_evidence(p_request_id uuid, p_version_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare
  r public.requests%rowtype;
  v public.document_versions%rowtype;
begin
  perform app.require_user();
  select * into r from public.requests where id = p_request_id for share;
  if r.id is null or not app.can_handle_request(r.organization_id, r.assignee_user_id) then
    raise exception 'Požadavek nebyl nalezen.' using errcode = 'PT404';
  end if;
  perform app.enforce_rate_limit('attach_request_evidence', 100, interval '1 hour');
  select dv.* into v from public.document_versions dv
    join public.documents d on d.id = dv.document_id
    where dv.id = p_version_id and dv.organization_id = r.organization_id
      and dv.upload_status = 'ready' and app.can_read_document(d.id)
    for share of d;
  if v.id is null then
    raise exception 'Verze dokumentu nebyla nalezena.' using errcode = 'PT404';
  end if;
  insert into public.request_evidence (request_id, organization_id, document_id, version_id)
    values (r.id, r.organization_id, v.document_id, v.id)
    on conflict (request_id, version_id) do nothing;
  if found then
    perform app.log_event(r.organization_id, 'attach_request_evidence', 'requests', r.id::text,
      '{}'::jsonb);
  end if;
end $$;
revoke execute on function public.attach_request_evidence(uuid, uuid) from public, anon, authenticated;
grant execute on function public.attach_request_evidence(uuid, uuid) to authenticated;
