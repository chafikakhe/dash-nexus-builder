-- ============================================================
-- INVITATION SYSTEM - DIAGNOSTIC & DEBUGGING GUIDE
-- ============================================================

-- 1. VERIFY FUNCTION EXISTS IN DATABASE
-- Run this query in Supabase SQL Editor to confirm the function is discoverable:
SELECT 
  p.proname AS function_name,
  n.nspname AS schema_name,
  pg_get_functiondef(p.oid) AS full_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'create_invitation'
ORDER BY p.proname;

-- Expected output: 1 row with create_invitation function in public schema

-- ============================================================
-- 2. CHECK FUNCTION SIGNATURE
-- The function signature MUST match the RPC call parameter order:
-- ============================================================

-- Function definition (from schema.sql):
/*
  create_invitation(
    _email text,           <- First parameter
    _org_id uuid,          <- Second parameter
    _role text,            <- Third parameter
    _invited_by uuid,      <- Fourth parameter
    _dashboard_ids uuid[]  <- Fifth parameter (optional, defaults to '{}')
  )
  RETURNS public.invitations
*/

-- RPC call from Members.tsx MUST match EXACTLY:
/*
  supabase.rpc("create_invitation", {
    _email: normalizedEmail,           // <- Matches parameter name
    _org_id: currentOrgId,             // <- Matches parameter name
    _role: inviteRole,                 // <- Matches parameter name
    _invited_by: user.id,              // <- Matches parameter name
    _dashboard_ids: inviteDashboardIds // <- Matches parameter name
  });
*/

-- ============================================================
-- 3. VERIFY RLS POLICIES ALLOW FUNCTION EXECUTION
-- ============================================================

-- Check that invitation insert policy allows function execution:
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'invitations'
ORDER BY policyname;

-- Key policies that must exist:
-- - invitations_insert: allows authenticated users with owner/admin role
-- - invitations_select: allows viewing own/org invitations or by recipient email

-- ============================================================
-- 4. TEST FUNCTION WITH SAMPLE DATA
-- ============================================================

-- Before running the full app, test the function directly:
SELECT public.create_invitation(
  _email := 'test@example.com',
  _org_id := (SELECT id FROM public.orgs LIMIT 1), -- Use existing org
  _role := 'member',
  _invited_by := auth.uid(),
  _dashboard_ids := '{}'::uuid[]
);

-- Expected response:
-- {
--   "id": "uuid-here",
--   "email": "test@example.com",
--   "org_id": "org-uuid",
--   "role": "member",
--   "invited_by": "user-uuid",
--   "status": "pending",
--   "token": "random-token-uuid",
--   "dashboard_ids": [],
--   "created_at": "2024-...",
--   "accepted_at": null
-- }

-- ============================================================
-- 5. TROUBLESHOOTING: "Could not find the function" ERROR
-- ============================================================

-- If you still get "Could not find the function public.create_invitation":

-- Step 1: Run schema cache reload (already in schema.sql):
NOTIFY pgrst, 'reload schema';

-- Step 2: Check PostgREST logs in Supabase dashboard
-- - Go to Supabase dashboard → API Docs
-- - Look for "create_invitation" in the RPC section
-- - If not visible, wait 10 seconds and refresh

-- Step 3: Manually refresh PostgREST (if available):
-- - In some Supabase projects, you can restart the PostgREST server
-- - Go to Dashboard → Project Settings → Infrastructure
-- - Restart the API server

-- Step 4: Verify parameter order hasn't changed
-- Run: SELECT to_json(row_to_json(p.*))
--      FROM pg_proc p WHERE proname = 'create_invitation'
-- Look at pg_get_function_result() output to verify types

-- ============================================================
-- 6. VERIFY SCHEMA CACHE RELOAD SIGNAL
-- ============================================================

-- Confirm the NOTIFY statement was added to schema.sql:
-- Look for at end of /supabase/schema.sql:
-- notify pgrst, 'reload schema';

-- When you run the entire schema.sql file, this will:
-- 1. Create/update all functions
-- 2. Send a NOTIFY signal to PostgREST
-- 3. PostgREST's schema cache will refresh within 5-10 seconds

-- ============================================================
-- 7. PRODUCTION CHECKLIST
-- ============================================================

-- [ ] Function exists in pg_proc (check with diagnostic query #1)
-- [ ] Parameter names match RPC call exactly (check with diagnostic query #2)
-- [ ] RLS policies allow execution (check with diagnostic query #3)
-- [ ] NOTIFY pgrst reload signal added to schema.sql
-- [ ] Members.tsx RPC call uses correct parameter order
-- [ ] Build completes without errors (npm run build)
-- [ ] Test invitation creation via UI
-- [ ] Verify invitation tokens are unique and valid
-- [ ] Check that dashboard_ids are stored and applied on acceptance

-- ============================================================
-- 8. COMMON ISSUES & FIXES
-- ============================================================

-- Issue: "Parameter not found: _org"
-- Fix: Change _org to _org_id in both function definition and RPC call

-- Issue: "Unexpected null value in non-nullable field"
-- Fix: Ensure all required parameters are passed (not null)
--      Check: _email, _org_id, _role, _invited_by are all required

-- Issue: "Permission denied for schema public"
-- Fix: Function uses SECURITY DEFINER, should bypass user RLS
--      If still denied, check that invited_by user has owner/admin role

-- Issue: "Invitation token is null"
-- Fix: Token is auto-generated with gen_random_uuid()
--      If null, check function executed successfully (see diagnostic #3)

-- ============================================================
-- 9. LOGGING & DEBUGGING IN FUNCTION
-- ============================================================

-- To add debug logging, update create_invitation function with:
-- RAISE NOTICE 'Creating invitation for email: %', _email;
-- RAISE NOTICE 'Organization ID: %', _org_id;
-- RAISE NOTICE 'Role: %', _role;

-- View logs in Supabase → Logs → Edge Functions
-- Or in browser console when calling via Supabase client

-- ============================================================
-- 10. ACCEPTANCE WORKFLOW
-- ============================================================

-- When user accepts invitation via Notifications page:
-- 1. Frontend calls: supabase.rpc('accept_invitation', { _token: token })
-- 2. accept_invitation function:
--    a. Finds the invitation by token
--    b. Verifies user email matches invite email
--    c. Adds user to org_members with specified role
--    d. Assigns dashboards from invitation.dashboard_ids
--    e. Marks invitation status = 'accepted'
-- 3. Frontend updates UI to show newly accepted workspace
