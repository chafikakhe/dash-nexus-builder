-- ============================================================
-- DashForge — RLS FIXES for Collection & Dashboard Insert Issues
-- ============================================================
--
-- PROBLEM:
-- - Collection creation fails silently or with 400 errors
-- - Dashboard layout save (drag & drop) fails silently
-- - Users lack 'editor' role even though they're org owners
--
-- ROOT CAUSE:
-- - RLS policies require user to have specific org role (owner/admin/editor)
-- - But org_members entry may not exist or role may be missing
-- - Or there's a race condition during org creation
--
-- SOLUTION:
-- This file provides:
-- 1. Verification queries to check your RLS setup
-- 2. Corrected RLS policies with logging-friendly structure
-- 3. Helper functions to auto-fix user roles
-- 4. Debugging queries
--
-- ============================================================

-- Step 1: Verify current RLS policies are correctly set up
-- Run these queries to diagnose the issue:

-- SELECT org_id, user_id, role FROM public.org_members WHERE user_id = '<your-user-uuid-here>' LIMIT 10;

-- Query B: Check if your org exists
SELECT id, name, slug, created_by FROM public.orgs LIMIT 5;

-- Query C: Check if the creator of the org is listed as owner in org_members
SELECT o.id as org_id, o.name, o.created_by, om.role
FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id AND o.created_by = om.user_id
LIMIT 10;

-- SELECT public.has_org_role('<org-uuid-here>'::uuid, '<user-uuid-here>'::uuid, array['owner','admin','editor']::public.app_role[]);

-- ============================================================
-- Step 2: Create a helper function to auto-fix missing org_members entries
-- ============================================================

-- This function ensures every org creator is added as 'owner' to org_members
-- Call this if users can't create collections/dashboards
CREATE OR REPLACE FUNCTION public.fix_missing_org_members()
RETURNS TABLE(fixed_count int, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_fixed_count INT := 0;
BEGIN
  -- Insert any missing org_members for org creators
  INSERT INTO public.org_members (org_id, user_id, role)
  SELECT o.id, o.created_by, 'owner'::public.app_role
  FROM public.orgs o
  LEFT JOIN public.org_members om ON o.id = om.org_id AND o.created_by = om.user_id
  WHERE o.created_by IS NOT NULL
    AND om.org_id IS NULL
  ON CONFLICT (org_id, user_id) DO NOTHING;
  
  GET DIAGNOSTICS v_fixed_count = ROW_COUNT;
  
  RETURN QUERY SELECT v_fixed_count, 'Fixed ' || v_fixed_count || ' missing org_members entries'::text;
END;
$$;

-- Execute the fix (run this in Supabase SQL editor)
-- SELECT * FROM public.fix_missing_org_members();

-- ============================================================
-- Step 3: Verify and rebuild RLS policies (if needed)
-- ============================================================

-- ORGS policies with secure owner-based insertion
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.orgs;
DROP POLICY IF EXISTS "Users can create their own workspace" ON public.orgs;
CREATE POLICY "Users can create their own workspace" ON public.orgs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() = created_by
  );

-- If policies still aren't working, drop and recreate them:

-- COLLECTIONS policies with explicit debugging
DROP POLICY IF EXISTS "collections_select" ON public.collections;
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT TO authenticated
  USING (
    -- Debug: User must be a member of the org
    public.is_org_member(org_id, auth.uid())
    OR
    -- Or be a platform admin
    public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "collections_insert" ON public.collections;
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    -- User must have editor, admin, or owner role in this org
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "collections_update" ON public.collections;
CREATE POLICY "collections_update" ON public.collections
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "collections_delete" ON public.collections;
CREATE POLICY "collections_delete" ON public.collections
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- DASHBOARDS policies with explicit debugging
DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
CREATE POLICY "dashboards_select" ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR
    public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
CREATE POLICY "dashboards_update" ON public.dashboards
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "dashboards_delete" ON public.dashboards;
CREATE POLICY "dashboards_delete" ON public.dashboards
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- COLLECTION_RECORDS policies with explicit debugging
DROP POLICY IF EXISTS "records_select" ON public.collection_records;
CREATE POLICY "records_select" ON public.collection_records
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR
    public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "records_insert" ON public.collection_records;
CREATE POLICY "records_insert" ON public.collection_records
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "records_update" ON public.collection_records;
CREATE POLICY "records_update" ON public.collection_records
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

DROP POLICY IF EXISTS "records_delete" ON public.collection_records;
CREATE POLICY "records_delete" ON public.collection_records
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- ============================================================
-- Step 4: Manual diagnostics
-- ============================================================

-- If you're still having issues, create a diagnostic view:
CREATE OR REPLACE VIEW public.debug_user_access AS
SELECT
  auth.uid() as current_user_id,
  (SELECT COUNT(*) FROM public.orgs) as total_orgs,
  (SELECT COUNT(*) FROM public.org_members WHERE user_id = auth.uid()) as my_org_count,
  (SELECT json_agg(json_build_object('org_id', org_id, 'role', role))
   FROM public.org_members WHERE user_id = auth.uid()) as my_roles;

-- View it:
-- SELECT * FROM public.debug_user_access;

-- ============================================================
-- TROUBLESHOOTING CHECKLIST:
-- ============================================================
-- 
-- 1. ✓ Check if your org has any org_members entries:
--    SELECT * FROM org_members WHERE org_id = '<your-org-id>';
--
-- 2. ✓ If none exist, run the fix function:
--    SELECT * FROM public.fix_missing_org_members();
--
-- 3. ✓ Check if the new entries were created:
--    SELECT * FROM org_members WHERE org_id = '<your-org-id>';
--
-- 4. ✓ Test if you can now insert a collection:
--    INSERT INTO collections (org_id, name, schema)
--    VALUES ('<org-id>'::uuid, 'Test', '[]'::jsonb)
--    RETURNING id, name;
--
-- 5. ✓ Check browser console for [collections] or [dashboards] logs
--    These will show exact error codes and messages
--
-- 6. ✓ If you see error code "PGRST301", that's RLS blocking
--    It means the user doesn't have the required role
--
-- ============================================================
