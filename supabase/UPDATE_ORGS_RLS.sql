-- ============================================================
-- DashForge — Supabase update: orgs owner_id and secure insert RLS
-- Run this script in Supabase SQL editor to update your orgs table.
-- ============================================================

-- 1) Add owner_id if it does not exist.
alter table public.orgs
  add column if not exists owner_id uuid references auth.users(id) on delete set null;

-- 2) Backfill existing org rows so owner_id matches created_by for existing data.
update public.orgs
set owner_id = created_by
where owner_id is null
  and created_by is not null;

-- 3) Recreate the secure insert policy for org creation.
drop policy if exists "orgs_insert_authenticated" on public.orgs;
drop policy if exists "Users can create their own workspace" on public.orgs;
create policy "Users can create their own workspace" on public.orgs
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    or auth.uid() = created_by
  );

-- 4) Optional: ensure read/select for org members and admins is preserved.
-- Leave existing orgs_member_select and orgs_admin_select policies in place.

-- 5) Verify the fix with a small select.
-- select id, name, owner_id, created_by from public.orgs limit 10;
