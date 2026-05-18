-- ============================================================
-- 004_FIX_MISSING_ORG_MEMBERS_HELPER.sql
-- Migration: Add helper function to auto-fix missing org_members entries
-- ============================================================

-- Helper function to auto-fix missing org_members entries
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

-- Test the function:
-- SELECT * FROM public.fix_missing_org_members();
