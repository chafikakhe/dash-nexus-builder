create table if not exists public.api_connections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  workspace_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  provider text not null,
  base_url text not null,
  method text not null default 'GET',
  auth_type text not null default 'none',
  token_encrypted text,
  headers_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.api_connections enable row level security;

create index if not exists api_connections_org_idx on public.api_connections(org_id);
create index if not exists api_connections_workspace_idx on public.api_connections(workspace_id);

alter table public.collections
  add column if not exists workspace_id uuid references public.orgs(id) on delete cascade,
  add column if not exists connection_id uuid references public.api_connections(id) on delete set null,
  add column if not exists schema_json jsonb not null default '[]'::jsonb,
  add column if not exists data_json jsonb not null default '[]'::jsonb,
  add column if not exists source_type text not null default 'manual';

update public.collections
set
  workspace_id = coalesce(workspace_id, org_id),
  schema_json = coalesce(schema_json, schema, '[]'::jsonb)
where workspace_id is null
   or schema_json = '[]'::jsonb;

create index if not exists collections_workspace_idx on public.collections(workspace_id);
create index if not exists collections_connection_idx on public.collections(connection_id);

drop policy if exists "api_connections_select" on public.api_connections;
create policy "api_connections_select" on public.api_connections
  for select to authenticated
  using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "api_connections_write" on public.api_connections;
create policy "api_connections_write" on public.api_connections
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

notify pgrst, 'reload schema';
