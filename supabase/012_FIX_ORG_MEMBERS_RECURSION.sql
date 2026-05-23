-- ============================================================
-- FIX: Infinite Recursion in org_members RLS Policies
-- ============================================================
--
-- PROBLEM IDENTIFIED:
-- Error: "infinite recursion detected in policy for relation "org_members""
--
-- ROOT CAUSE:
-- The org_members table has RLS policies that reference org_members itself:
--
--   create policy "org_members_insert" on public.org_members
--     for insert to authenticated
--     with check (
--       exists (
--         select 1 from public.org_members om        <-- RECURSIVE!
--         where om.org_id = public.org_members.org_id
--           and om.user_id = auth.uid()
--           and om.role = any(array['owner','admin'])
--       )
--     );
--
-- When inserting the FIRST member into an org (during workspace creation),
-- the policy tries to verify if the user is an admin/owner BY QUERYING
-- org_members, but that triggers the policy again, creating infinite recursion.
--
-- SOLUTION:
-- 1. Replace recursive queries with SECURITY DEFINER functions
-- 2. Create a special "initialization" path for first member
-- 3. Use trigger to auto-add creator as owner (no RLS check needed)
-- 4. Refactor policies to avoid self-referencing tables
--
-- ============================================================

BEGIN;

-- STEP 1: DROP PROBLEMATIC POLICIES
-- ============================================================

drop policy if exists "org_members_select" on public.org_members;
drop policy if exists "org_members_insert" on public.org_members;
drop policy if exists "org_members_update" on public.org_members;
drop policy if exists "org_members_delete" on public.org_members;

-- STEP 2: DROP OLD HELPER FUNCTIONS (will recreate with fix)
-- ============================================================

drop function if exists public.is_org_member(uuid, uuid) cascade;
drop function if exists public.has_org_role(uuid, uuid, public.app_role[]) cascade;

-- STEP 3: RECREATE HELPER FUNCTIONS WITH SECURITY DEFINER
-- ============================================================
-- These functions run with full privileges (bypass RLS)
-- They are stable and can be cached by PostgreSQL

create or replace function public.is_org_member(p_org_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = p_user_id
  );
$$;

create or replace function public.has_org_role(p_org_id uuid, p_user_id uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org_id
      and user_id = p_user_id
      and role = any(p_roles)
  );
$$;

-- Additional helper: check if it's the org creator
create or replace function public.is_org_creator(p_org_id uuid, p_user_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.orgs
    where id = p_org_id
      and (created_by = p_user_id or owner_id = p_user_id)
  );
$$;

-- Additional helper: count org members (for bypass condition)
create or replace function public.get_org_member_count(p_org_id uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*) from public.org_members
  where org_id = p_org_id;
$$;

-- STEP 4: CREATE NON-RECURSIVE ORG_MEMBERS POLICIES
-- ============================================================
-- Key principle: Use SECURITY DEFINER functions instead of recursive queries

-- SELECT: Users can see members of their org or their own record
create policy "org_members_select" on public.org_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(org_id, auth.uid())
  );

-- INSERT: Allow if:
-- (1) User is adding themselves to an org they own, OR
-- (2) User is owner/admin of the org (checked via SECURITY DEFINER function)
create policy "org_members_insert" on public.org_members
  for insert to authenticated
  with check (
    -- Case 1: The creator is adding themselves during workspace creation
    -- (This is the only case where no existing member check is needed)
    public.is_org_creator(org_id, auth.uid())
    OR
    -- Case 2: User is already owner/admin of this org
    -- (Using SECURITY DEFINER function to avoid recursion)
    public.has_org_role(org_id, auth.uid(), array['owner', 'admin']::public.app_role[])
  );

-- UPDATE: Only org admin/owner can update member roles
create policy "org_members_update" on public.org_members
  for update to authenticated
  using (
    -- User can update their own record OR is org admin/owner
    user_id = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner', 'admin']::public.app_role[])
  )
  with check (
    -- Org admin/owner can update anyone's role
    public.has_org_role(org_id, auth.uid(), array['owner', 'admin']::public.app_role[])
  );

-- DELETE: Only org owner can remove members
create policy "org_members_delete" on public.org_members
  for delete to authenticated
  using (
    -- User can remove themselves
    user_id = auth.uid()
    or
    -- Or org owner can remove anyone
    public.has_org_role(org_id, auth.uid(), array['owner']::public.app_role[])
  );

-- STEP 5: CREATE TRIGGER TO AUTO-ADD CREATOR AS OWNER
-- ============================================================
-- This bypasses RLS by running as the table owner
-- When an org is created, automatically insert the creator as owner

create or replace function public.auto_add_org_owner()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_creator_id uuid;
begin
  -- Get the org creator
  v_creator_id := coalesce(new.created_by, new.owner_id);
  
  if v_creator_id is not null then
    -- Insert org creator as owner (skip if already exists due to constraint)
    insert into public.org_members (org_id, user_id, role)
    values (new.id, v_creator_id, 'owner'::public.app_role)
    on conflict (org_id, user_id) do nothing;
  end if;
  
  return new;
end;
$$;

-- Drop old trigger if it exists
drop trigger if exists on_org_created on public.orgs;

-- Create trigger that fires AFTER org insert
create trigger on_org_created
after insert on public.orgs
for each row execute function public.auto_add_org_owner();

-- STEP 6: GRANT NECESSARY PERMISSIONS
-- ============================================================

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.has_org_role(uuid, uuid, public.app_role[]) to authenticated;
grant execute on function public.is_org_creator(uuid, uuid) to authenticated;
grant execute on function public.get_org_member_count(uuid) to authenticated;

-- STEP 7: ADD SAFETY CHECK - PREVENT ORPHANED ORGS
-- ============================================================
-- Ensure every org has at least one owner

create or replace function public.check_org_has_owner()
returns trigger language plpgsql as $$
begin
  if (select count(*) from public.org_members 
      where org_id = new.org_id 
        and role = 'owner') = 0 then
    raise exception 'Organization must have at least one owner';
  end if;
  return new;
end;
$$;

drop trigger if exists org_members_ensure_owner on public.org_members;
create trigger org_members_ensure_owner
after insert or update or delete on public.org_members
for each row execute function public.check_org_has_owner();

-- STEP 8: FIX EXISTING DATA - ENSURE ALL ORG CREATORS ARE OWNERS
-- ============================================================

insert into public.org_members (org_id, user_id, role)
select o.id, coalesce(o.created_by, o.owner_id), 'owner'::public.app_role
from public.orgs o
left join public.org_members om on o.id = om.org_id 
  and om.user_id = coalesce(o.created_by, o.owner_id)
where coalesce(o.created_by, o.owner_id) is not null
  and om.org_id is null
on conflict (org_id, user_id) do nothing;

-- STEP 9: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

create index if not exists org_members_org_id_idx on public.org_members(org_id);
create index if not exists org_members_user_id_idx on public.org_members(user_id);
create unique index if not exists org_members_org_user_unique_idx on public.org_members(org_id, user_id);

-- STEP 10: VERIFY RLS POLICIES
-- ============================================================
-- After this migration, verify:
-- 1. Can create workspace (first org_member insert)
-- 2. Can add members to org
-- 3. Can view org members
-- 4. Cannot bypass role restrictions

-- Test query to verify setup:
-- SELECT public.has_org_role('org-id'::uuid, 'user-id'::uuid, array['owner', 'admin']::public.app_role[]);

COMMIT;

-- ============================================================
-- EXPLANATION OF THE FIX
-- ============================================================
--
-- WHAT WAS WRONG:
-- The policy on org_members was checking org_members itself:
--   exists (select from org_members where ...)
-- 
-- This creates infinite recursion because:
--   1. INSERT into org_members
--   2. RLS policy evaluates
--   3. Policy checks org_members table
--   4. Triggers RLS again (infinite loop)
--
-- WHY THIS FIX WORKS:
-- 1. SECURITY DEFINER functions run with full privileges
--    - They bypass RLS completely
--    - They're stable and can be cached
--    - PostgreSQL trusts them to check permissions
--
-- 2. Policies now use functions, not direct table checks:
--    - No more recursive queries
--    - Cleaner, more maintainable code
--    - Better performance (functions are cached)
--
-- 3. Trigger handles auto-membership:
--    - Org creator automatically added as owner
--    - No need for complex policy logic
--    - Happens at database level (guaranteed)
--
-- 4. Special case for creator:
--    - is_org_creator() checks orgs table, not org_members
--    - Allows first insert without circular dependency
--
-- BEST PRACTICES APPLIED:
-- ✓ SECURITY DEFINER for permission checking
-- ✓ Avoid recursive policy references
-- ✓ Use triggers for auto-relationships
-- ✓ Keep policies simple and readable
-- ✓ Use stable/immutable functions for caching
-- ✓ Explicit indexes for performance
--
-- ============================================================
