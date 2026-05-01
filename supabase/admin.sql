-- ============================================================
-- DashForge — Admin extension (run AFTER schema.sql)
-- Adds is_admin flag + cross-org admin RLS policies.
-- Idempotent: safe to re-run.
-- ============================================================

-- 1. Add is_admin flag to profiles
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

-- 2. Security-definer helper to check admin status without RLS recursion
create or replace function public.is_platform_admin(_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.profiles where id = _user),
    false
  )
$$;

-- 3. Admin-wide policies (additive — keep existing org-scoped policies)
-- Profiles: admins can update anyone (e.g. ban / promote)
drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

-- Orgs: admins can read every org
drop policy if exists "orgs_admin_select" on public.orgs;
create policy "orgs_admin_select" on public.orgs
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Org members: admins can read every membership
drop policy if exists "members_admin_select" on public.org_members;
create policy "members_admin_select" on public.org_members
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Dashboards: admins can read every dashboard
drop policy if exists "dashboards_admin_select" on public.dashboards;
create policy "dashboards_admin_select" on public.dashboards
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- Collections: admins can read every collection
drop policy if exists "collections_admin_select" on public.collections;
create policy "collections_admin_select" on public.collections
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

-- ============================================================
-- 4. Collection records storage
--    Each collection's rows live in JSON for flexibility.
-- ============================================================
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

-- ============================================================
-- HOW TO PROMOTE YOURSELF TO ADMIN
--   update public.profiles set is_admin = true where email = 'you@example.com';
-- ============================================================
