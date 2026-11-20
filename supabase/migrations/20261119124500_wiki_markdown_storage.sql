-- Private original Markdown revisions. No client Storage policy grants access.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('svj-wiki-markdown', 'svj-wiki-markdown', false, 1048576, array['text/markdown'])
on conflict (id) do update set public = false;

create table public.wiki_markdown_revisions (
  organization_id uuid not null references public.organizations (id),
  note_key text not null check (note_key ~ '^[a-z0-9-]{1,80}$'),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  object_key text generated always as (organization_id::text || '/' || note_key || '/' || content_sha256 || '.md') stored,
  imported_at timestamptz not null default now(),
  primary key (organization_id, note_key, content_sha256)
);
alter table public.wiki_markdown_revisions enable row level security;
revoke all on public.wiki_markdown_revisions from public, anon, authenticated;
