-- ============================================================
-- 003_FIX_COLLECTIONS_DASHBOARDS_RLS.sql
-- Migration: Ensure collection/dashboard RLS policies require org_members role
-- ============================================================

-- COLLECTIONS policies
DROP POLICY IF EXISTS "collections_select" ON public.collections;
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
  );

DROP POLICY IF EXISTS "collections_insert" ON public.collections;
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
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

-- DASHBOARDS policies
DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
CREATE POLICY "dashboards_select" ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
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

-- COLLECTION_RECORDS policies
DROP POLICY IF EXISTS "records_select" ON public.collection_records;
CREATE POLICY "records_select" ON public.collection_records
  FOR SELECT TO authenticated
  USING (
    public.is_org_member(org_id, auth.uid())
    OR public.is_platform_admin(auth.uid())
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
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );
