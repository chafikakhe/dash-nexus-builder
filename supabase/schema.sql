-- ============================================================
-- DashForge — Multi-tenant schema (run in Supabase SQL editor)
-- Idempotent: safe to re-run during development.
-- ============================================================

-- Roles enum (org-level RBAC)
do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

-- ---------- orgs ----------
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;

-- ---------- org_members (membership + role) ----------
create table if not exists public.org_members (
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.org_members enable row level security;

-- ---------- dashboards ----------
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

-- ---------- collections ----------
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create index if not exists collections_org_idx on public.collections(org_id);

-- ============================================================
-- Security definer helpers (avoid RLS recursion)
-- ============================================================
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

-- ============================================================
-- RLS policies
-- ============================================================

-- profiles: users read/update their own row; everyone authenticated can read basic profile
drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

-- orgs: members can read; only authenticated users can create (becomes owner via trigger)
drop policy if exists "orgs_member_select" on public.orgs;
create policy "orgs_member_select" on public.orgs
  for select to authenticated using (public.is_org_member(id, auth.uid()));

drop policy if exists "orgs_insert_authenticated" on public.orgs;
create policy "orgs_insert_authenticated" on public.orgs
  for insert to authenticated with check (auth.uid() = created_by);

drop policy if exists "orgs_owner_update" on public.orgs;
create policy "orgs_owner_update" on public.orgs
  for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['owner','admin']::public.app_role[]));

-- org_members: members can read; owners/admins manage
drop policy if exists "members_select" on public.org_members;
create policy "members_select" on public.org_members
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "members_insert_admin" on public.org_members;
create policy "members_insert_admin" on public.org_members
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or not exists (select 1 from public.org_members where org_id = org_members.org_id) -- bootstrap first owner
  );

drop policy if exists "members_update_admin" on public.org_members;
create policy "members_update_admin" on public.org_members
  for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "members_delete_admin" on public.org_members;
create policy "members_delete_admin" on public.org_members
  for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

-- dashboards: any member can read; editors+ can write
drop policy if exists "dashboards_select" on public.dashboards;
create policy "dashboards_select" on public.dashboards
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "dashboards_insert" on public.dashboards;
create policy "dashboards_insert" on public.dashboards
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

drop policy if exists "dashboards_update" on public.dashboards;
create policy "dashboards_update" on public.dashboards
  for update to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

drop policy if exists "dashboards_delete" on public.dashboards;
create policy "dashboards_delete" on public.dashboards
  for delete to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- collections: same as dashboards
drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "collections_write" on public.collections;
create policy "collections_write" on public.collections
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]));

-- ============================================================
-- Triggers
-- ============================================================

-- Auto-create profile on signup
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

-- Make org creator the owner
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
