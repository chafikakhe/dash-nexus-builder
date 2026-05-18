-- ============================================================
-- DashForge — Multi-tenant schema (run in Supabase SQL editor)
-- Idempotent: safe to re-run during development.
-- ============================================================

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

alter type public.app_role add value if not exists 'member';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;
alter table public.orgs add column if not exists owner_id uuid references auth.users(id) on delete set null;

create table if not exists public.org_members (
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.org_members enable row level security;

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('member','admin')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  dashboard_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted')),
  token text unique not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.invitations enable row level security;

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  layout jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboards enable row level security;
create index if not exists dashboards_org_idx on public.dashboards(org_id);

create table if not exists public.dashboard_permissions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dashboard_id, user_id)
);
alter table public.dashboard_permissions enable row level security;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create index if not exists collections_org_idx on public.collections(org_id);

create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = _org and user_id = _user)
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = _user and role = any(_roles)
  )
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1
      from public.org_members self_org
      join public.org_members peer_org on peer_org.org_id = self_org.org_id
      where self_org.user_id = auth.uid()
        and peer_org.user_id = public.profiles.id
    )
  );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "orgs_member_select" on public.orgs;
create policy "orgs_member_select" on public.orgs
  for select to authenticated using (public.is_org_member(id, auth.uid()));

drop policy if exists "orgs_insert_authenticated" on public.orgs;
drop policy if exists "Users can create their own workspace" on public.orgs;
create policy "Users can create their own workspace" on public.orgs
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    OR auth.uid() = created_by
  );

drop policy if exists "orgs_owner_update" on public.orgs;
create policy "orgs_owner_update" on public.orgs
  for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "members_select" on public.org_members;
create policy "members_select" on public.org_members
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "members_insert_admin" on public.org_members;
create policy "members_insert_admin" on public.org_members
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or not exists (select 1 from public.org_members where org_id = org_members.org_id)
  );

drop policy if exists "members_update_admin" on public.org_members;
create policy "members_update_admin" on public.org_members
  for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "members_delete_admin" on public.org_members;
create policy "members_delete_admin" on public.org_members
  for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or public.is_org_member(org_id, auth.uid())
    or lower(email) = lower((select email from public.profiles where id = auth.uid()))
  );

drop policy if exists "invitations_insert" on public.invitations;
create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "invitations_update" on public.invitations;
create policy "invitations_update" on public.invitations
  for update to authenticated
  using (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  )
  with check (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "invitations_delete" on public.invitations;
create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

create or replace function public.accept_invitation(_token text)
returns table(org_id uuid, user_id uuid, role public.app_role)
language plpgsql security definer set search_path = public as $$
declare
  invite record;
  accepted_role public.app_role := 'member';
begin
  -- Validate input
  if _token is null or _token = '' then
    raise exception 'Invitation token is required';
  end if;

  -- Fetch the invitation
  select * into invite
  from public.invitations
  where token = _token
  limit 1;

  if invite.id is null then
    raise exception 'Invitation not found or already accepted.';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invitation already accepted.';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to accept invitation.';
  end if;

  if not exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = lower(invite.email)
  ) then
    raise exception 'Please sign in with % to accept this invitation.', invite.email;
  end if;

  if invite.role = 'admin' then
    accepted_role := 'admin';
  end if;

  -- Add user to org_members with appropriate role
  insert into public.org_members (org_id, user_id, role)
  values (invite.org_id, auth.uid(), accepted_role)
  on conflict (org_id, user_id) do update
    set role = case
      when org_members.role = 'owner' then 'owner'
      when excluded.role = 'admin' then 'admin'
      else org_members.role
    end;

  -- Assign dashboards if specified
  if array_length(invite.dashboard_ids, 1) is not null and array_length(invite.dashboard_ids, 1) > 0 then
    insert into public.dashboard_permissions (dashboard_id, user_id, org_id)
    select d.id, auth.uid(), invite.org_id
    from public.dashboards d
    where d.id = any(invite.dashboard_ids) and d.org_id = invite.org_id
    on conflict (dashboard_id, user_id) do nothing;
  end if;

  -- Mark invitation as accepted
  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = invite.id;

  return query select invite.org_id, auth.uid(), accepted_role;
end;
$$;

create or replace function public.create_invitation(
  _email text,
  _org_id uuid,
  _role text,
  _invited_by uuid,
  _dashboard_ids uuid[] default '{}'
)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare
  invite_row public.invitations;
  invite_exists boolean;
begin
  -- Validate inputs
  if _email is null or _email = '' then
    raise exception 'Email is required';
  end if;
  if _org_id is null then
    raise exception 'Organization ID is required';
  end if;
  if _invited_by is null then
    raise exception 'Invited by user ID is required';
  end if;

  -- Check for duplicate pending invitation
  select exists(
    select 1 from public.invitations
    where org_id = _org_id and lower(email) = lower(_email) and status = 'pending'
  ) into invite_exists;

  if invite_exists then
    raise exception 'An invitation is already pending for %', _email;
  end if;

  -- Insert the invitation
  insert into public.invitations (email, org_id, role, invited_by, dashboard_ids, status)
  values (lower(trim(_email)), _org_id, _role, _invited_by, coalesce(_dashboard_ids, '{}'), 'pending')
  returning * into invite_row;

  return invite_row;
end;
$$;

drop policy if exists "dashboards_select" on public.dashboards;
create policy "dashboards_select" on public.dashboards
  for select to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or exists (
      select 1 from public.dashboard_permissions dp
      where dp.dashboard_id = public.dashboards.id
        and dp.user_id = auth.uid()
    )
  );

drop policy if exists "dashboards_insert" on public.dashboards;
create policy "dashboards_insert" on public.dashboards
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboards_update" on public.dashboards;
create policy "dashboards_update" on public.dashboards
  for update to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboards_delete" on public.dashboards;
create policy "dashboards_delete" on public.dashboards
  for delete to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "collections_write" on public.collections;
create policy "collections_write" on public.collections
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "dashboard_permissions_select" on public.dashboard_permissions;
create policy "dashboard_permissions_select" on public.dashboard_permissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboard_permissions_write" on public.dashboard_permissions;
create policy "dashboard_permissions_write" on public.dashboard_permissions
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_org_created on public.orgs;
create trigger on_org_created
  after insert on public.orgs
  for each row execute function public.handle_new_org();

-- Admin extension:
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_platform_admin(_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.profiles where id = _user),
    false
  )
$$;

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop policy if exists "orgs_admin_select" on public.orgs;
create policy "orgs_admin_select" on public.orgs
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "members_admin_select" on public.org_members;
create policy "members_admin_select" on public.org_members
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "dashboards_admin_select" on public.dashboards;
create policy "dashboards_admin_select" on public.dashboards
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "collections_admin_select" on public.collections;
create policy "collections_admin_select" on public.collections
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

create table if not exists public.collection_records (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collection_records enable row level security;
create index if not exists records_collection_idx on public.collection_records(collection_id);
create index if not exists records_org_idx on public.collection_records(org_id);

drop policy if exists "records_select" on public.collection_records;
create policy "records_select" on public.collection_records
  for select to authenticated
  using (
    public.is_org_member(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "records_write" on public.collection_records;
create policy "records_write" on public.collection_records
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]));

-- Signal PostgREST to reload schema cache (fixes "Could not find the function" errors)
notify pgrst, 'reload schema';
