-- ============================================================
-- 002_FIX_ORGS_RLS_POLICIES.sql
-- Migration: Secure RLS policies for org insert with owner_id
-- ============================================================

-- Drop old policies
DROP POLICY IF EXISTS "orgs_insert_authenticated" ON public.orgs;
DROP POLICY IF EXISTS "Users can create their own workspace" ON public.orgs;

-- Create secure insert policy: only owner can insert
CREATE POLICY "Users can create their own workspace" ON public.orgs
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = owner_id
    OR auth.uid() = created_by
  );

-- Ensure select policy allows org members to read
DROP POLICY IF EXISTS "orgs_member_select" ON public.orgs;
CREATE POLICY "orgs_member_select" ON public.orgs
  FOR SELECT TO authenticated
  USING (public.is_org_member(id, auth.uid()));

-- Ensure update policy allows only owners/admins
DROP POLICY IF EXISTS "orgs_owner_update" ON public.orgs;
CREATE POLICY "orgs_owner_update" ON public.orgs
  FOR UPDATE TO authenticated
  USING (public.has_org_role(id, auth.uid(), array['owner','admin']::public.app_role[]));
