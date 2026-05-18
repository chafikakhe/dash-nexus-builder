-- ============================================================
-- VERIFY_MIGRATION.sql
-- Diagnostic queries to verify migrations were successful
-- ============================================================

-- Query 1: Check if owner_id column exists and is populated
SELECT 
  COUNT(*) as total_orgs,
  COUNT(owner_id) as orgs_with_owner_id,
  COUNT(created_by) as orgs_with_created_by
FROM public.orgs;

-- Query 2: Check for any orgs without owner_id (should be 0 after migration)
SELECT id, name, owner_id, created_by
FROM public.orgs
WHERE owner_id IS NULL
LIMIT 10;

-- Query 3: Verify org_members entries exist for org creators
SELECT 
  o.id as org_id,
  o.name,
  o.owner_id,
  COUNT(om.user_id) as member_count,
  MAX(CASE WHEN om.user_id = o.owner_id THEN om.role END) as owner_role
FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id
GROUP BY o.id, o.name, o.owner_id
ORDER BY o.created_at DESC
LIMIT 10;

-- Query 4: Check for orgs that need fix_missing_org_members()
SELECT o.id, o.name, o.owner_id
FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id AND o.owner_id = om.user_id
WHERE o.owner_id IS NOT NULL
  AND om.org_id IS NULL;

-- Query 5: Test RLS by checking current user's access
-- SELECT id, name, owner_id FROM public.orgs LIMIT 5;
