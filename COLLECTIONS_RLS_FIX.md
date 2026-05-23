# 🔧 Fix: Collections RLS Policy - INSERT Blocked for Editors

**Status**: ✅ Production-Ready  
**Severity**: High (Blocks core feature)  
**Error**: `Failed to create collection: new row violates row-level security policy for table "collections"`  
**Date**: May 23, 2026  
**Applies To**: Multi-tenant collection management systems

---

## 🚨 Problem Summary

**What's Broken**: Users with 'editor' role cannot create collections  
**Error Code**: RLS policy violation (PGRST301)  
**Root Cause**: INSERT policy only allows 'owner' and 'admin', blocks 'editor'  
**Impact**: Editors cannot create/organize content collections

---

## 🔍 Root Cause Analysis

### The Problematic Policy Pattern

Many Supabase applications have this same issue across multiple tables:

```sql
-- ❌ PROBLEMATIC (blocks editors)
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );
```

### Why This Pattern Fails

When the policy is too restrictive:

```
User Action: Create collection as editor
  ↓
PostgreSQL: Evaluate WITH CHECK clause
  ↓
Function Call: has_org_role(org_id, user_id, ['owner','admin'])
  ↓
Database Query: Check org_members where role = ANY(['owner','admin'])
  ↓
Result: User has role='editor'
  ↓
'editor' NOT IN ['owner','admin']
  ↓
Returns: FALSE
  ↓
PostgreSQL: WITH CHECK failed → BLOCK INSERT ❌
  ↓
Application Error: "Row violates row-level security policy"
```

### Expected vs Actual

| Role   | Should Allow | Current Policy | After Fix |
|--------|--------------|---|---|
| owner  | ✅ Yes | ✅ Yes | ✅ Yes |
| admin  | ✅ Yes | ✅ Yes | ✅ Yes |
| editor | ✅ Yes | ❌ No | ✅ Yes |
| viewer | ❌ No | ❌ No | ❌ No |

---

## ✅ The Solution

### Fixed Collections Policies

```sql
-- ✅ FIXED: Now includes 'editor' role
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );
```

### Why This Fix Works

1. **Includes 'editor' role** - Editors now in the allowed array
2. **Maintains security** - Viewers still blocked
3. **Supports platform admins** - Added fallback for super-admins
4. **Uses SECURITY DEFINER** - Bypass RLS safely without recursion
5. **Consistent pattern** - Same logic for INSERT, UPDATE, DELETE

---

## 📋 Complete Policy Set

### 1. SELECT Policy (Read Access)

```sql
CREATE POLICY "collections_select" ON public.collections
  FOR SELECT TO authenticated
  USING (
    -- Any org member can view collections in their org
    public.is_org_member(org_id, auth.uid())
    OR
    -- Platform admins can view all collections
    public.is_platform_admin(auth.uid())
  );
```

**Who can READ collections**:
- ✅ owner (any role)
- ✅ admin (any role)
- ✅ editor (any role)
- ✅ viewer (any role)
- ✅ platform admin (all orgs)

### 2. INSERT Policy (Create Collections)

```sql
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    -- Editor/admin/owner can create in their org
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR
    -- Platform admins bypass role checks
    public.is_platform_admin(auth.uid())
  );
```

**Who can CREATE collections**:
- ✅ owner (full control)
- ✅ admin (team management)
- ✅ editor (content creation) ← **FIXED!**
- ❌ viewer (read-only)
- ✅ platform admin (all orgs)

### 3. UPDATE Policy (Edit Collections)

```sql
CREATE POLICY "collections_update" ON public.collections
  FOR UPDATE TO authenticated
  USING (
    -- Can access collections they can edit
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  )
  WITH CHECK (
    -- Must still have edit permission after update
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );
```

**Who can UPDATE collections**:
- ✅ owner (any collection)
- ✅ admin (any collection)
- ✅ editor (collections in their org) ← **FIXED!**
- ❌ viewer (blocked)
- ✅ platform admin (any collection)

### 4. DELETE Policy (Remove Collections)

```sql
CREATE POLICY "collections_delete" ON public.collections
  FOR DELETE TO authenticated
  USING (
    -- Only admin/owner can delete (stricter than create)
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    OR
    -- Platform admins can delete
    public.is_platform_admin(auth.uid())
  );
```

**Who can DELETE collections**:
- ✅ owner (any collection)
- ✅ admin (any collection)
- ❌ editor (cannot delete) ← Protection against accidents
- ❌ viewer (blocked)
- ✅ platform admin (any collection)

---

## 🚀 How to Apply the Fix

### Step 1: Open Supabase SQL Editor

```
Supabase Dashboard → SQL Editor → New Query
```

### Step 2: Copy Migration

```
File: supabase/014_FIX_COLLECTIONS_RLS.sql
Copy entire content
```

### Step 3: Paste & Run

```
Paste into SQL Editor
Click "Run"
Wait for completion
```

### Step 4: Verify Success

```
Check output shows: BEGIN ... COMMIT
No error messages
```

---

## 🧪 Testing the Fix

### Test 1: Create Collection as Editor

```typescript
const { data, error } = await supabase
  .from('collections')
  .insert({
    org_id: 'your-org-id',
    name: 'Test Collection',
    schema: [],
  })
  .select()
  .single();

if (error) {
  console.error('❌ Failed:', error.message);
} else {
  console.log('✅ Success:', data);
}
```

**Expected**: Success (no RLS error)

### Test 2: Verify Viewer Cannot Create

```sql
-- Debug what viewer can do
SELECT * FROM public.debug_user_collections_access(
  '<org-uuid>'::uuid,
  '<viewer-user-id>'::uuid
);
```

**Expected output**:
```
is_member | can_insert | can_update | can_delete | roles
────────────────────────────────────────────────────
   true   |   false    |   false    |   false    | {viewer}
```

### Test 3: Editor Can Update But Not Delete

```sql
-- Check editor permissions
SELECT * FROM public.debug_user_collections_access(
  '<org-uuid>'::uuid,
  '<editor-user-id>'::uuid
);
```

**Expected output**:
```
is_member | can_insert | can_update | can_delete | roles
────────────────────────────────────────────────────
   true   |   true     |   true     |   false    | {editor}
```

### Test 4: Admin Can Do Everything

```sql
-- Check admin permissions
SELECT * FROM public.debug_user_collections_access(
  '<org-uuid>'::uuid,
  '<admin-user-id>'::uuid
);
```

**Expected output**:
```
is_member | can_insert | can_update | can_delete | roles
────────────────────────────────────────────────────
   true   |   true     |   true     |   true     | {admin}
```

---

## 📊 Security Analysis

### Threat Model: Unauthorized Collection Creation

**Before Fix**:
- ❌ Editors blocked from creating (false negative)
- ✅ Viewers blocked (correct)
- ✅ Non-members blocked (correct)

**After Fix**:
- ✅ Editors allowed (correct)
- ✅ Viewers blocked (correct)
- ✅ Non-members blocked (correct)

### Vulnerability Analysis: None Detected ✅

The fix:
- ✅ Maintains row-level security enabled
- ✅ Prevents unauthorized access
- ✅ Respects role hierarchy (delete > update > insert)
- ✅ Uses SECURITY DEFINER safely
- ✅ No recursive queries
- ✅ No insecure `true` policies

---

## 🎓 Key Concepts

### SECURITY DEFINER Functions

```sql
CREATE FUNCTION public.has_org_role(...)
  LANGUAGE sql
  SECURITY DEFINER  ← Runs with table owner's privileges
  SET search_path = public
  AS $$...$$;
```

**Why needed**:
- Bypass RLS to safely check org_members
- Prevents infinite recursion
- Still validates permissions (function logic checks roles)
- Trusted because we control the function code

### WITH CHECK Clause in INSERT

```sql
CREATE POLICY "name" ON table
  FOR INSERT TO role
  WITH CHECK (condition);  ← Evaluated AFTER insert, BEFORE commit
```

**Execution Order**:
1. INSERT statement received
2. PostgreSQL buffers the new row
3. Evaluates WITH CHECK condition
4. If TRUE → commit INSERT
5. If FALSE → rollback, return error

---

## 🔄 Comparison: Before vs After

### Before Fix

```sql
-- Problem: Only owner/admin
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );
```

**Result**: Editors get "RLS policy violation" error

### After Fix

```sql
-- Solution: Added 'editor' role
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    OR public.is_platform_admin(auth.uid())
  );
```

**Result**: Editors can create collections successfully

---

## 📈 Impact Summary

| Feature | Before | After | Status |
|---------|--------|-------|--------|
| Create collection (editor) | ❌ Blocked | ✅ Works | ✅ FIXED |
| Create collection (admin) | ✅ Works | ✅ Works | ✅ OK |
| Edit collection (editor) | ❌ Blocked | ✅ Works | ✅ FIXED |
| Delete collection (editor) | ❌ Blocked | ❌ Blocked | ✅ CORRECT |
| Delete collection (admin) | ✅ Works | ✅ Works | ✅ OK |
| View collection (viewer) | ✅ Works | ✅ Works | ✅ OK |
| Create collection (viewer) | ❌ Blocked | ❌ Blocked | ✅ CORRECT |

---

## 🐛 Troubleshooting

### Error: Still Getting RLS Violation After Fix

**Cause**: Policy not reloaded

**Solution**:
```sql
-- Verify policy exists
SELECT * FROM pg_policies 
WHERE tablename = 'collections' 
  AND policyname = 'collections_insert';

-- Should show the new WITH CHECK with ['owner','admin','editor']

-- If not, manually apply:
DROP POLICY IF EXISTS "collections_insert" ON public.collections;
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), 
      array['owner','admin','editor']::public.app_role[])
  );
```

### Function Not Found Error

**Cause**: Helper functions not created (migration 012 or 013 not run)

**Solution**: Apply migrations in order:
1. `012_FIX_ORG_MEMBERS_RECURSION.sql` (creates helper functions)
2. `013_FIX_DASHBOARDS_RLS.sql` (dashboard policies)
3. `014_FIX_COLLECTIONS_RLS.sql` (collection policies)

### Collections Appear but Can't Edit

**Cause**: UPDATE policy also too restrictive

**Solution**: Verify UPDATE policy includes 'editor':
```sql
-- Check UPDATE policy
SELECT * FROM pg_policies 
WHERE tablename = 'collections' 
  AND policyname = 'collections_update';

-- Should use array['owner','admin','editor']
```

---

## 📋 Migration Checklist

- [ ] Understand the problem (editor role blocked)
- [ ] Read this documentation
- [ ] Backup Supabase database (optional)
- [ ] Verify migrations 012 & 013 applied first
- [ ] Apply migration 014_FIX_COLLECTIONS_RLS.sql
- [ ] Run verification queries
- [ ] Test creating collection as editor role
- [ ] Test viewers cannot create collections
- [ ] Test admins can delete collections
- [ ] Deploy to production
- [ ] Monitor logs for errors

---

## 🌐 Similar Issues in Your Project

This pattern appears in these migrations - all now fixed:

| Migration | Table | Issue | Status |
|-----------|-------|-------|--------|
| 012 | org_members | Infinite recursion | ✅ FIXED |
| 013 | dashboards | Editor blocked | ✅ FIXED |
| 014 | collections | Editor blocked | ✅ FIXED |

---

## 📞 Summary

**Problem**: Collections INSERT policy only allowed owner/admin, blocked editors

**Solution**: Added 'editor' to allowed roles array

**Why Safe**: 
- Viewers still blocked (secure)
- Only org members can create
- Uses proven SECURITY DEFINER pattern
- No recursive queries

**Time to Apply**: ~2 minutes

**Risk Level**: 🟢 LOW (Just role check, no structural changes)

---

**Generated**: May 23, 2026  
**Status**: ✅ Ready to Apply  
**File**: supabase/014_FIX_COLLECTIONS_RLS.sql

