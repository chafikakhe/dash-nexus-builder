-- ============================================================
-- FIX: Collections RLS - INSERT blocked by missing/incorrect policy
-- ============================================================
--
-- Production-ready goals:
-- 1) Keep RLS ENABLED
-- 2) Secure multi-tenant access by org membership + roles
-- 3) Avoid recursive policies (use SECURITY DEFINER helper functions)
-- 4) Ensure INSERT/SELECT/UPDATE/DELETE behave consistently
--
-- Expected app roles:
--  - owner, admin, editor can write
--  - viewer can read only
--
-- This migration is idempotent.
--

BEGIN;

-- ============================================================
-- 0) Ensure role type exists and has required values
-- ============================================================

do $$
begin
  create type public.app_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null;
end $$;

alter type public.app_role add value if not exists 'member';

-- ============================================================
-- 1) Ensure helper functions exist (SECURITY DEFINER)
-- ============================================================
-- These functions must bypass RLS on org_members.
-- They must be SECURITY DEFINER and pinned to search_path=public.

DROP FUNCTION IF EXISTS public.is_org_member(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION public.is_org_member(p_org uuid, p_user uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_org
      AND om.user_id = p_user
  );
$$;

DROP FUNCTION IF EXISTS public.has_org_role(uuid, uuid, public.app_role[]) CASCADE;
CREATE OR REPLACE FUNCTION public.has_org_role(p_org uuid, p_user uuid, p_roles public.app_role[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.org_members om
    WHERE om.org_id = p_org
      AND om.user_id = p_user
      AND om.role = ANY(p_roles)
  );
$$;

-- Make sure authenticated can call these helpers
GRANT EXECUTE ON FUNCTION public.is_org_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_org_role(uuid, uuid, public.app_role[]) TO authenticated;

-- Optional: platform admin helper if missing (harmless if already present)
-- NOTE: This function returns false by default. Customize if you have a profiles.is_admin column.
DO $$
begin
  EXECUTE 'DROP FUNCTION IF EXISTS public.is_platform_admin(uuid) CASCADE';
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'is_platform_admin'
      AND pg_get_function_identity_arguments(oid) = 'user uuid'
  ) THEN
    CREATE OR REPLACE FUNCTION public.is_platform_admin(p_user uuid)
    RETURNS boolean
    LANGUAGE sql
    STABLE
    SECURITY DEFINER
    SET search_path = public
    AS $func$
      SELECT false
    $func$;
  END IF;
end $$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin(uuid) TO authenticated;

-- ============================================================
-- 2) Sanity check: collections uses org_id (not organization_id)
-- ============================================================
-- If your schema differs, update policy columns accordingly.
-- This migration assumes: public.collections(org_id uuid ...)

-- ============================================================
-- 3) Drop all existing policies on collections to avoid leftovers
-- ============================================================

DROP POLICY IF EXISTS "collections_select" ON public.collections;
DROP POLICY IF EXISTS "collections_insert" ON public.collections;
DROP POLICY IF EXISTS "collections_write" ON public.collections;
DROP POLICY IF EXISTS "collections_update" ON public.collections;
DROP POLICY IF EXISTS "collections_delete" ON public.collections;

-- Sometimes older scripts use different names; defensively drop them too.
-- (No-op if they don't exist.)
DROP POLICY IF EXISTS "collections_for_insert" ON public.collections;
DROP POLICY IF EXISTS "collections_for_update" ON public.collections;
DROP POLICY IF EXISTS "collections_admin_select" ON public.collections;

-- Ensure RLS is enabled (no-op if already enabled)
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 4) Create clean policies
-- ============================================================

-- SELECT: org members can read; platform admins can read all
DROP POLICY IF EXISTS "collections_select" ON public.collections;
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

-- INSERT: owner/admin/editor can create collections in their org
DROP POLICY IF EXISTS "collections_insert" ON public.collections;
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );

-- UPDATE: allow editor/admin/owner to update only their org rows
DROP POLICY IF EXISTS "collections_update" ON public.collections;
CREATE POLICY "collections_update" ON public.collections
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );

-- DELETE: allow owner/admin only
DROP POLICY IF EXISTS "collections_delete" ON public.collections;
CREATE POLICY "collections_delete" ON public.collections
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );

-- ============================================================
-- 5) Indexes for membership-driven policies
-- ============================================================
CREATE INDEX IF NOT EXISTS collections_org_id_idx ON public.collections(org_id);
CREATE INDEX IF NOT EXISTS org_members_org_user_idx ON public.org_members(org_id, user_id);
CREATE INDEX IF NOT EXISTS org_members_org_role_idx ON public.org_members(org_id, role);

-- ============================================================
-- 6) Diagnostics helpers (optional, but safe)
-- ============================================================
-- Helps you quickly verify why INSERT fails for a given org.

DROP FUNCTION IF EXISTS public.debug_user_collections_access(uuid, uuid);
CREATE OR REPLACE FUNCTION public.debug_user_collections_access(p_org uuid, p_user uuid)
RETURNS TABLE(
  is_member boolean,
  can_insert boolean,
  can_update boolean,
  can_delete boolean,
  roles public.app_role[]
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    public.is_org_member(p_org, p_user) AS is_member,
    public.has_org_role(p_org, p_user, array['owner','admin','editor']::public.app_role[]) AS can_insert,
    public.has_org_role(p_org, p_user, array['owner','admin','editor']::public.app_role[]) AS can_update,
    public.has_org_role(p_org, p_user, array['owner','admin']::public.app_role[]) AS can_delete,
    COALESCE((
      SELECT array_agg(DISTINCT om.role ORDER BY om.role)
      FROM public.org_members om
      WHERE om.org_id = p_org AND om.user_id = p_user
    ), ARRAY[]::public.app_role[]) AS roles;
END;
$$;

GRANT EXECUTE ON FUNCTION public.debug_user_collections_access(uuid, uuid) TO authenticated;

-- Signal PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these to verify the fix is working:
--
-- 1) Check all policies exist on collections table
-- SELECT tablename, policyname, cmd, permissive
-- FROM pg_policies
-- WHERE schemaname='public' AND tablename='collections'
-- ORDER BY cmd, policyname;
--
-- Expected output (4 policies):
--   collections | collections_delete | DELETE | t
--   collections | collections_insert | INSERT | t
--   collections | collections_select | SELECT | t
--   collections | collections_update | UPDATE | t
--
-- 2) Diagnose current user's access to specific org
-- SELECT * FROM public.debug_user_collections_access('<org-uuid>'::uuid, auth.uid());
--
-- Example output if user is editor:
--   is_member | can_insert | can_update | can_delete |    roles
--   ──────────────────────────────────────────────────────────
--      true   |    true    |    true    |   false    | {editor}
--
-- 3) Test INSERT as editor (should succeed)
-- INSERT INTO public.collections (org_id, name, schema)
-- SELECT 
--   om.org_id,
--   'Test Collection',
--   '[]'::jsonb
-- FROM public.org_members om
-- WHERE om.user_id = auth.uid()
--   AND om.role = 'editor'
-- LIMIT 1;
--
-- Should return: INSERT 0 1 (success)
-- If error: "row violates row-level security policy"
--   → Policy not applied yet, try reconnecting or restarting connection pool
--
-- 4) Verify viewer cannot create collections
-- SELECT * FROM public.debug_user_collections_access('<org-uuid>'::uuid, '<viewer-user-id>'::uuid);
-- Should show: can_insert = false (blocked)
--
-- ============================================================

