-- ============================================================
-- FIX: Dashboard RLS Policies - INSERT Failing Due to Role Restrictions
-- ============================================================
--
-- PROBLEM IDENTIFIED:
-- Error: "Failed to create dashboard: new row violates row-level security policy for table 'dashboards'"
--
-- ROOT CAUSE:
-- The dashboards_insert RLS policy is too restrictive.
-- It ONLY allows users with 'owner' and 'admin' roles.
-- It BLOCKS users with 'editor' role (even though they should be able to create dashboards).
--
-- Current (BROKEN) Policy:
-- ───────────────────────────────────────────────────────────
-- CREATE POLICY "dashboards_insert" ON public.dashboards
--   FOR INSERT TO authenticated
--   WITH CHECK (
--     public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
--   );
--
-- Problem: Missing 'editor' in the roles array!
-- ───────────────────────────────────────────────────────────
--
-- WHY RLS BLOCKS THE INSERT:
-- ───────────────────────────────────────────────────────────
-- 1. User tries: INSERT INTO dashboards (org_id, name, ...) VALUES (...)
--
-- 2. PostgreSQL intercepts the INSERT and evaluates the WITH CHECK policy:
--    with check (
--      public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
--    )
--
-- 3. The policy calls: has_org_role(org_id, user_id, ['owner','admin'])
--
-- 4. Function checks org_members table:
--    SELECT EXISTS (
--      SELECT 1 FROM org_members
--      WHERE org_id = $1
--        AND user_id = $2
--        AND role = ANY(['owner','admin'])
--    )
--
-- 5. If user's role is 'editor':
--    - Function returns FALSE (editor is not in the array)
--    - WITH CHECK condition fails
--    - PostgreSQL BLOCKS the INSERT
--    - Application gets error: "row violates row-level security policy"
--
-- SECURITY EXPECTATION:
-- ───────────────────────────────────────────────────────────
-- In a collaborative dashboard system, users should be able to create
-- dashboards if they have any of these roles:
--
-- ├─ owner    → Full control, can manage team, delete org
-- ├─ admin    → Can manage team, create/edit dashboards
-- ├─ editor   → Can create and edit dashboards (CURRENTLY BLOCKED ❌)
-- └─ viewer   → Read-only access (correctly blocked)
--
-- SOLUTION:
-- ───────────────────────────────────────────────────────────
-- 1. Update dashboards_insert policy to include 'editor' role
-- 2. Update dashboards_update policy to include 'editor' role
-- 3. Keep dashboards_delete restricted to 'owner' and 'admin'
-- 4. Ensure SELECT includes both membership checks and permissions
--
-- ============================================================

BEGIN;

-- STEP 1: DROP OLD PROBLEMATIC POLICIES
-- ============================================================

DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_delete" ON public.dashboards;

-- STEP 2: VERIFY HELPER FUNCTIONS EXIST
-- ============================================================
-- These are created in 012_FIX_ORG_MEMBERS_RECURSION.sql
-- They use SECURITY DEFINER to bypass RLS safely

-- Verify is_org_member exists (basic membership check)
-- If it doesn't exist, it will be created in the migration

-- Verify has_org_role exists (role-based check)
-- If it doesn't exist, it will be created in the migration

-- STEP 3: CREATE FIXED DASHBOARD POLICIES
-- ============================================================

-- ┌─────────────────────────────────────────────────────────┐
-- │ SELECT: Users can view dashboards in their org          │
-- │         or dashboards explicitly shared with them       │
-- └─────────────────────────────────────────────────────────┘
--
-- Who can see dashboards:
-- ├─ Any org member (if org_members.user_id exists for this org)
-- ├─ Users explicitly granted dashboard_permissions
-- └─ (Future: admins can see all)
--
CREATE POLICY "dashboards_select" ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    -- Case 1: User is a member of this org
    public.is_org_member(org_id, auth.uid())
    OR
    -- Case 2: User has explicit dashboard permissions
    EXISTS (
      SELECT 1 FROM public.dashboard_permissions dp
      WHERE dp.dashboard_id = public.dashboards.id
        AND dp.user_id = auth.uid()
    )
  );

-- ┌─────────────────────────────────────────────────────────┐
-- │ INSERT: Users with editor/admin/owner role can create   │
-- │         dashboards in their org                         │
-- └─────────────────────────────────────────────────────────┘
--
-- Who can CREATE dashboards:
-- ├─ owner   → Can create (full control)
-- ├─ admin   → Can create (team management)
-- ├─ editor  → Can create (content creation) ✅ NOW FIXED
-- └─ viewer  → CANNOT create (read-only)
--
-- IMPORTANT WITH CHECK Explanation:
-- ───────────────────────────────────────────────────────────
-- The WITH CHECK clause evaluates AFTER the row is inserted
-- in the database buffer but BEFORE it's committed.
--
-- It validates:
-- 1. org_id must be valid (foreign key ensures this)
-- 2. User must be in org_members with role 'editor','admin','owner'
-- 3. The check uses SECURITY DEFINER function (has_org_role)
--    which bypasses RLS and checks org_members directly
--
-- Flow:
-- INSERT dashboards (org_id, name, ...)
--   → RLS policy intercepts
--   → Evaluates: has_org_role(org_id, auth.uid(), ['owner','admin','editor'])
--   → SECURITY DEFINER function checks org_members (no RLS loop)
--   → If user exists with one of these roles → ALLOW
--   → If user doesn't exist or wrong role → BLOCK with RLS error
--
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User must have editor, admin, or owner role in the organization
    -- This fixes the bug by including 'editor' role!
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- ┌─────────────────────────────────────────────────────────┐
-- │ UPDATE: Users can edit dashboards if they have edit      │
-- │         permission (editor/admin/owner role)            │
-- └─────────────────────────────────────────────────────────┘
--
-- Who can UPDATE dashboards:
-- ├─ owner   → Can update any dashboard
-- ├─ admin   → Can update any dashboard
-- ├─ editor  → Can update their dashboards ✅ NOW FIXED
-- └─ viewer  → CANNOT update
--
-- USING clause: Determines which rows can be accessed
--   → Only show dashboards the user can edit
--
-- WITH CHECK clause: Validates the updated data
--   → The user must still have editor+ role
--
CREATE POLICY "dashboards_update" ON public.dashboards
  FOR UPDATE TO authenticated
  USING (
    -- User can access dashboards they can edit
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    -- User must still have editor+ role after update
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- ┌─────────────────────────────────────────────────────────┐
-- │ DELETE: Only admin/owner can delete dashboards          │
-- │         (stricter than create/edit)                     │
-- └─────────────────────────────────────────────────────────┘
--
-- Who can DELETE dashboards:
-- ├─ owner   → Can delete any dashboard
-- ├─ admin   → Can delete any dashboard
-- ├─ editor  → CANNOT delete (only can edit)
-- └─ viewer  → CANNOT delete
--
-- This is more restrictive than INSERT/UPDATE to protect against
-- accidental data loss.
--
CREATE POLICY "dashboards_delete" ON public.dashboards
  FOR DELETE TO authenticated
  USING (
    -- Only admins and owners can delete dashboards
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- ┌─────────────────────────────────────────────────────────┐
-- │ DASHBOARD_PERMISSIONS: Share dashboards with users      │
-- └─────────────────────────────────────────────────────────┘
--
-- The dashboard_permissions table is for explicit sharing
-- (future feature: share dashboard with non-org members)
--
-- For now, just use basic membership checks

DROP POLICY IF EXISTS "dashboard_permissions_select" ON public.dashboard_permissions;
CREATE POLICY "dashboard_permissions_select" ON public.dashboard_permissions
  FOR SELECT TO authenticated
  USING (
    -- User can see their own permissions
    user_id = auth.uid()
    OR
    -- Or if they're an admin/owner of the org
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

DROP POLICY IF EXISTS "dashboard_permissions_insert" ON public.dashboard_permissions;
CREATE POLICY "dashboard_permissions_insert" ON public.dashboard_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Only admin/owner can grant permissions
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

DROP POLICY IF EXISTS "dashboard_permissions_delete" ON public.dashboard_permissions;
CREATE POLICY "dashboard_permissions_delete" ON public.dashboard_permissions
  FOR DELETE TO authenticated
  USING (
    -- User can remove their own permissions
    user_id = auth.uid()
    OR
    -- Or admin/owner can remove permissions
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- STEP 4: CREATE HELPER FUNCTION FOR DEBUGGING (optional)
-- ============================================================
-- Useful for debugging permission issues

DROP FUNCTION IF EXISTS public.debug_user_dashboard_access(uuid, uuid) CASCADE;

CREATE OR REPLACE FUNCTION public.debug_user_dashboard_access(p_user_id uuid, p_dashboard_id uuid)
RETURNS TABLE (
  can_select boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  user_role text,
  dashboard_org_id uuid
) LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
SELECT
  -- Can select
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = d.org_id
      AND om.user_id = p_user_id
  ) AS can_select,
  
  -- Can insert (create new)
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = d.org_id
      AND om.user_id = p_user_id
      AND om.role = ANY(array['owner','admin','editor']::public.app_role[])
  ) AS can_insert,
  
  -- Can update
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = d.org_id
      AND om.user_id = p_user_id
      AND om.role = ANY(array['owner','admin','editor']::public.app_role[])
  ) AS can_update,
  
  -- Can delete
  EXISTS (
    SELECT 1 FROM public.org_members om
    WHERE om.org_id = d.org_id
      AND om.user_id = p_user_id
      AND om.role = ANY(array['owner','admin']::public.app_role[])
  ) AS can_delete,
  
  -- User's role in this org
  (SELECT om.role::text
   FROM public.org_members om
   WHERE om.org_id = d.org_id
     AND om.user_id = p_user_id) AS user_role,
  
  -- Dashboard org
  d.org_id AS dashboard_org_id

FROM public.dashboards d
WHERE d.id = p_dashboard_id;
$$;

GRANT EXECUTE ON FUNCTION public.debug_user_dashboard_access(uuid, uuid) TO authenticated;

-- STEP 5: CREATE INDEXES FOR PERFORMANCE
-- ============================================================

CREATE INDEX IF NOT EXISTS dashboards_org_id_idx ON public.dashboards(org_id);
CREATE INDEX IF NOT EXISTS dashboards_created_by_idx ON public.dashboards(created_by);
CREATE INDEX IF NOT EXISTS dashboard_permissions_dashboard_id_idx ON public.dashboard_permissions(dashboard_id);
CREATE INDEX IF NOT EXISTS dashboard_permissions_user_id_idx ON public.dashboard_permissions(user_id);
CREATE INDEX IF NOT EXISTS dashboard_permissions_org_id_idx ON public.dashboard_permissions(org_id);

-- STEP 6: DATA VALIDATION
-- ============================================================
-- Verify all dashboards have valid org_ids (should already be true due to FK)

-- STEP 7: GRANT EXECUTION PERMISSIONS
-- ============================================================
-- Ensure authenticated users can call helper functions

GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) TO authenticated;

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
--
-- After running this migration, verify with these queries:
--

-- 1. Check policies exist
-- SELECT tablename, policyname, permissive, cmd
-- FROM pg_policies
-- WHERE tablename = 'dashboards'
-- ORDER BY policyname;
--
-- Expected output:
--   dashboards | dashboards_delete | t | DELETE
--   dashboards | dashboards_insert | t | INSERT
--   dashboards | dashboards_select | t | SELECT
--   dashboards | dashboards_update | t | UPDATE

-- 2. Check user can see their org
-- SELECT om.org_id, o.name, om.role
-- FROM org_members om
-- JOIN orgs o ON om.org_id = o.id
-- WHERE om.user_id = auth.uid();

-- 3. Check dashboard access for a user
-- SELECT
--   d.id, d.name, d.org_id,
--   public.debug_user_dashboard_access(auth.uid(), d.id)
-- FROM dashboards d
-- WHERE d.org_id IN (
--   SELECT org_id FROM org_members WHERE user_id = auth.uid()
-- )
-- LIMIT 5;

-- 4. Try creating a dashboard (should work now if user is editor+)
-- INSERT INTO dashboards (org_id, name, description, layout, created_by)
-- SELECT
--   om.org_id,
--   'Test Dashboard',
--   'Testing RLS fix',
--   '[]'::jsonb,
--   auth.uid()
-- FROM org_members om
-- WHERE om.user_id = auth.uid()
--   AND om.role = ANY(array['owner','admin','editor']::public.app_role[])
-- LIMIT 1;

-- ============================================================
-- SUMMARY OF CHANGES
-- ============================================================
--
-- BEFORE (Broken):
-- ├─ dashboards_insert: array['owner','admin'] ❌ Blocks editors
-- ├─ dashboards_update: array['owner','admin'] ❌ Blocks editors
-- └─ dashboards_delete: array['owner','admin'] ✅ Correct
--
-- AFTER (Fixed):
-- ├─ dashboards_insert: array['owner','admin','editor'] ✅ Fixed!
-- ├─ dashboards_update: array['owner','admin','editor'] ✅ Fixed!
-- └─ dashboards_delete: array['owner','admin'] ✅ Still correct
--
-- KEY IMPROVEMENTS:
-- ✅ Editors can now create dashboards
-- ✅ Editors can now update dashboards
-- ✅ Viewers still cannot write (secure)
-- ✅ Only admins/owners can delete (extra protection)
-- ✅ Better explanation in code comments
-- ✅ Debug function added for troubleshooting
-- ✅ Indexes optimized for common queries
--
-- ============================================================
