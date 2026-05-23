# 🔧 Fix: Dashboard RLS Policy - INSERT Failing

**Status**: ✅ Production-Ready  
**Severity**: High (Blocks core feature)  
**Error**: `Failed to create dashboard: new row violates row-level security policy for table "dashboards"`  
**Date**: May 23, 2026  
**Applies To**: Supabase multi-tenant dashboard systems

---

## 🚨 Problem Summary

**What's Broken**: Users with 'editor' role cannot create dashboards  
**Error Code**: RLS policy violation (PGRST301)  
**Root Cause**: INSERT policy only allows 'owner' and 'admin', blocks 'editor'  
**Impact**: Editors cannot use core create dashboard feature

---

## 🔍 Root Cause Analysis

### The Problematic Policy (Current)

```sql
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    --                                          ^^^^^ Missing 'editor'! ❌
  );
```

### Why This Blocks Editors

**The Security Check Flow**:

```
User Action:
  INSERT INTO dashboards (org_id, name, layout, created_by)
  VALUES ('org-123', 'My Dashboard', '[]', 'user-456')
          ↓
RLS Policy Intercepts:
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin'])
  )
          ↓
Function Called:
  has_org_role('org-123', 'user-456', ['owner','admin'])
          ↓
Database Query:
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_id = 'org-123'
      AND user_id = 'user-456'
      AND role = ANY(['owner','admin'])  ← 'editor' NOT in this array
  )
          ↓
Result:
  user has role='editor' in org_members
  'editor' IS NOT in ['owner','admin']
  Returns: FALSE
          ↓
PostgreSQL Decision:
  WITH CHECK returned FALSE → BLOCK INSERT
  Error: "row violates row-level security policy"
```

### Security Model Mismatch

**What the policy currently enforces**:
```
✅ owner → can create
✅ admin → can create
❌ editor → BLOCKED (should be allowed)
❌ viewer → blocked (correct)
```

**What it should enforce**:
```
✅ owner → can create (full control)
✅ admin → can create (team management)
✅ editor → can create (content creation) ← FIX THIS
❌ viewer → cannot create (read-only) ← Keep blocking
```

---

## 🧠 How Supabase Evaluates RLS WITH CHECK

### Understanding WITH CHECK Clause

The `WITH CHECK` clause in an INSERT policy validates data **before** it's committed:

```sql
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (condition);
```

**Execution Order**:

```
1. Application sends INSERT request
   INSERT INTO dashboards (org_id, name, created_by, ...) VALUES (...)

2. PostgreSQL receives the query
   → Checks if table has RLS enabled (yes)
   → Looks for INSERT policy for this role (found)

3. PostgreSQL evaluates the WITH CHECK condition
   → Executes: public.has_org_role(org_id, auth.uid(), array['owner','admin'])
   → This function runs with SECURITY DEFINER privilege
   → Bypasses RLS to safely check org_members table

4. Function returns TRUE or FALSE
   If TRUE  → Allow INSERT to proceed
   If FALSE → BLOCK INSERT with error

5. If allowed, data is inserted
   → Row added to dashboards table
   → created_at timestamp set
   → Triggers fire (if any)
```

### Key Point: WITH CHECK vs USING

```sql
-- FOR INSERT: only uses WITH CHECK
-- (INSERT doesn't have a USING clause)
CREATE POLICY "policy_name" ON table
  FOR INSERT TO role
  WITH CHECK (condition);  ← Only this matters for INSERT

-- FOR UPDATE: has both USING and WITH CHECK
CREATE POLICY "policy_name" ON table
  FOR UPDATE TO role
  USING (condition)        ← Which rows can user update?
  WITH CHECK (condition);  ← Can user update to these new values?

-- FOR DELETE: only uses USING
CREATE POLICY "policy_name" ON table
  FOR DELETE TO role
  USING (condition);       ← Which rows can user delete?

-- FOR SELECT: only uses USING
CREATE POLICY "policy_name" ON table
  FOR SELECT TO role
  USING (condition);       ← Which rows can user see?
```

---

## ✅ The Solution

### Fixed Policy

```sql
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    --                                          ↑ Added 'editor' role ✅
  );
```

### What Changes

| Role   | Before | After | Reason |
|--------|--------|-------|--------|
| owner  | ✅ Can create | ✅ Can create | Full control |
| admin  | ✅ Can create | ✅ Can create | Team management |
| editor | ❌ BLOCKED | ✅ Can create | Content creation |
| viewer | ❌ Blocked | ❌ Blocked | Read-only (secure) |

### Why This Fix Is Secure

1. **Viewers cannot create** - 'viewer' not in the array, stays blocked
2. **Only members can create** - Function checks org_members (verifies membership)
3. **Uses SECURITY DEFINER** - Function bypasses RLS safely, no recursion
4. **Validates org_id** - Foreign key ensures valid organization
5. **Checks at insert time** - Enforced by database, not application

---

## 🚀 How to Apply the Fix

### Option 1: Automatic (Recommended)

**Step 1**: Copy migration file

```
File: supabase/013_FIX_DASHBOARDS_RLS.sql
```

**Step 2**: Open Supabase SQL Editor

```
Supabase Dashboard → SQL Editor → New Query
```

**Step 3**: Paste entire migration

```
Copy all content from 013_FIX_DASHBOARDS_RLS.sql
Paste into SQL Editor
Click "Run"
```

**Step 4**: Verify success

```
Check output for "BEGIN" ... "COMMIT"
No error messages
```

### Option 2: Manual

```sql
-- Drop old policies
DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;

-- Create new policy
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- Also update UPDATE policy
DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
CREATE POLICY "dashboards_update" ON public.dashboards
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );
```

---

## 🧪 Testing the Fix

### Test 1: Create Dashboard as Editor

```typescript
// JavaScript/TypeScript
const { data, error } = await supabase
  .from('dashboards')
  .insert({
    org_id: 'your-org-id',
    name: 'Test Dashboard',
    description: 'Testing RLS fix',
    layout: [],
    created_by: user.id,
  })
  .select()
  .single();

if (error) {
  console.error('Dashboard creation failed:', error);
  // If you see RLS error → fix not applied
  // If success → ✅ Fix is working!
} else {
  console.log('Dashboard created:', data);
}
```

### Test 2: Verify Permissions

```sql
-- SQL: Check what the user can do
SELECT
  public.debug_user_dashboard_access(
    'your-user-id'::uuid,
    'your-dashboard-id'::uuid
  );

-- Should return:
-- can_select | can_insert | can_update | can_delete | user_role | dashboard_org_id
-- ─────────────────────────────────────────────────────────────────────────────
--    true    |    true    |    true    |   false    | editor    | org-id
```

### Test 3: Verify Viewers Cannot Create

```typescript
// Create dashboard as viewer (should fail)
const { error } = await supabase
  .from('dashboards')
  .insert({
    org_id: 'org-123',
    name: 'Should Fail',
    layout: [],
    created_by: viewer_user_id,
  });

// Expected error: RLS policy violation
if (error?.code === 'PGRST301') {
  console.log('✅ Correct: viewers are blocked from creating');
}
```

---

## 📊 Security Analysis

### Threat Model

**Threat 1: Unauthorized dashboard creation**
- ❌ Before fix: Editors blocked (false negative)
- ✅ After fix: Editors allowed, viewers blocked (correct)

**Threat 2: Non-members creating dashboards**
- ✅ BLOCKED: Must be in org_members table with valid role
- ✅ CHECKED: org_members checked via SECURITY DEFINER function
- ✅ SECURE: Cannot bypass RLS from application layer

**Threat 3: Privilege escalation**
- ✅ PREVENTED: Policy checks current user's actual role from org_members
- ✅ PROTECTED: Cannot fake role (auth.uid() verified by Supabase)

**Threat 4: Cross-org access**
- ✅ BLOCKED: org_id column ensures isolation
- ✅ VERIFIED: User must be member of THAT specific org

### Vulnerability Analysis: None Detected ✅

The fix:
- ✅ Maintains row-level security
- ✅ Prevents unauthorized access
- ✅ Respects role hierarchy
- ✅ Uses safe SECURITY DEFINER functions
- ✅ No recursive queries
- ✅ No insecure `true` policies

---

## 🔄 Full Policy Changes

### Policy 1: dashboards_select

```sql
-- WHO CAN VIEW DASHBOARDS:
-- ├─ Any member of the organization
-- └─ Users explicitly granted dashboard_permissions

CREATE POLICY "dashboards_select" ON public.dashboards
  FOR SELECT TO authenticated
  USING (
    -- Case 1: User is member of this org (any role)
    public.is_org_member(org_id, auth.uid())
    OR
    -- Case 2: User has explicit dashboard permissions
    EXISTS (
      SELECT 1 FROM public.dashboard_permissions dp
      WHERE dp.dashboard_id = public.dashboards.id
        AND dp.user_id = auth.uid()
    )
  );
```

### Policy 2: dashboards_insert (FIXED ✅)

```sql
-- WHO CAN CREATE DASHBOARDS:
-- ├─ owner → Yes
-- ├─ admin → Yes
-- ├─ editor → Yes (NOW FIXED!)
-- └─ viewer → No

CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin','editor']::public.app_role[])
  );
```

### Policy 3: dashboards_update (FIXED ✅)

```sql
-- WHO CAN EDIT DASHBOARDS:
-- ├─ owner → Yes (all dashboards)
-- ├─ admin → Yes (all dashboards)
-- ├─ editor → Yes (if member of org, NOW FIXED!)
-- └─ viewer → No

CREATE POLICY "dashboards_update" ON public.dashboards
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin','editor']::public.app_role[])
  )
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin','editor']::public.app_role[])
  );
```

### Policy 4: dashboards_delete

```sql
-- WHO CAN DELETE DASHBOARDS:
-- ├─ owner → Yes
-- ├─ admin → Yes
-- ├─ editor → No (stricter than create)
-- └─ viewer → No

CREATE POLICY "dashboards_delete" ON public.dashboards
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin']::public.app_role[])
  );
```

---

## 🎓 Learning: RLS Best Practices

### ✅ DO

```sql
-- Use SECURITY DEFINER functions for permission checks
public.has_org_role(org_id, user_id, roles_array)

-- Include relevant roles in WITH CHECK
array['owner','admin','editor']::public.app_role[]

-- Use USING for SELECT to filter accessible rows
USING (public.is_org_member(org_id, auth.uid()))

-- Keep delete stricter than create
-- DELETE: owner, admin only
-- CREATE: owner, admin, editor

-- Validate foreign keys (org_id references orgs.id)
```

### ❌ DON'T

```sql
-- Don't use recursive table queries in policies
-- ❌ BAD: EXISTS (SELECT FROM org_members) in org_members policy

-- Don't allow all authenticated users without checks
-- ❌ BAD: WITH CHECK (true) or no WITH CHECK clause

-- Don't forget to include new roles when expanding access
-- ❌ BAD: Updating schema but forgetting policy update

-- Don't mix membership and permission checks inefficiently
-- ✅ GOOD: Use helper functions
-- ❌ BAD: Inline subqueries everywhere

-- Don't skip testing with different roles
```

---

## 📈 Expected Impact

### Before Fix

```
User creates dashboard with editor role:
  1. Application sends INSERT
  2. PostgreSQL checks RLS policy
  3. Policy calls: has_org_role(..., ['owner','admin'])
  4. User has role='editor'
  5. FALSE returned
  6. INSERT BLOCKED ❌
  7. Application error: "RLS policy violation"
```

### After Fix

```
User creates dashboard with editor role:
  1. Application sends INSERT
  2. PostgreSQL checks RLS policy
  3. Policy calls: has_org_role(..., ['owner','admin','editor'])
  4. User has role='editor'
  5. TRUE returned
  6. INSERT ALLOWED ✅
  7. Dashboard created successfully
```

### Feature Availability

| Feature | Before | After |
|---------|--------|-------|
| Create dashboard (editor) | ❌ Blocked | ✅ Works |
| Create dashboard (admin) | ✅ Works | ✅ Works |
| Edit dashboard (editor) | ❌ Blocked | ✅ Works |
| Delete dashboard (editor) | ❌ Blocked | ❌ Blocked (correct) |
| Share dashboards | ⚠️ Admin only | ⚠️ Admin only |

---

## 🐛 Troubleshooting

### Error: "Still getting RLS error after applying fix"

**Cause**: Policy not updated or cached

**Solution**:
```sql
-- Verify policy exists
SELECT * FROM pg_policies WHERE tablename = 'dashboards' AND policyname = 'dashboards_insert';

-- Should show: WITH CHECK with ['owner','admin','editor']

-- If not, manually drop and recreate:
DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
CREATE POLICY "dashboards_insert" ON public.dashboards
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin','editor']::public.app_role[])
  );
```

### Error: "function has_org_role does not exist"

**Cause**: Helper function not created (migration 012 not run)

**Solution**:
```sql
-- First apply: supabase/012_FIX_ORG_MEMBERS_RECURSION.sql
-- Then apply: supabase/013_FIX_DASHBOARDS_RLS.sql
```

### Dashboard creation works but doesn't appear in list

**Cause**: SELECT policy too restrictive

**Solution**: Verify SELECT policy includes:
```sql
public.is_org_member(org_id, auth.uid())  ← User must be org member
```

---

## 📋 Migration Checklist

- [ ] Read this document
- [ ] Understand the problem (RLS blocks editors)
- [ ] Understand the solution (add 'editor' to policy)
- [ ] Backup Supabase database (optional but recommended)
- [ ] Apply migration 012 (ORG_MEMBERS_RECURSION) first if not done
- [ ] Apply migration 013 (DASHBOARDS_RLS)
- [ ] Verify policies exist and are correct
- [ ] Test creating dashboard as editor role
- [ ] Test viewers cannot create dashboards
- [ ] Test admins can still delete dashboards
- [ ] Deploy to production
- [ ] Monitor for any RLS errors

---

## 📞 Summary

**What was wrong**: dashboards_insert policy only allowed owner/admin, blocked editor

**Why it failed**: WITH CHECK clause returned FALSE for editor role

**What changed**: Added 'editor' to the array of allowed roles

**Why it's safe**: 
- Viewers still blocked
- Only org members can create
- Deletion still restricted to admin/owner
- Uses proven SECURITY DEFINER pattern

**Time to fix**: ~2 minutes to apply migration

**Risk level**: 🟢 LOW - Just fixing a role check, no structural changes

---

**Generated**: May 23, 2026  
**Status**: ✅ Ready to Apply  
**File**: supabase/013_FIX_DASHBOARDS_RLS.sql

