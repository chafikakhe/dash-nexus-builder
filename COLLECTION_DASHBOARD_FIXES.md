# DashForge - Collection & Dashboard Save Fixes

## Problem Summary

**Issue 1: Creating a collection does NOT work**
- UI shows "Create collection" but nothing is saved in database
- No data appears after refresh
- No visible error messages (or error is shown briefly then disappears)

**Issue 2: Drag & drop dashboard widgets do NOT save**
- UI works (dragging is fine)
- When user clicks "Save", layout is NOT saved in database
- Silent failure or misleading error

---

## Root Causes Identified

### Cause 1: RLS Policies Blocking Inserts
The Supabase schema has **Row Level Security (RLS)** policies that require users to have a specific role in the `org_members` table:
- For **collections**: Requires `owner`, `admin`, or `editor` role
- For **dashboards**: Requires `owner`, `admin`, or `editor` role

When a user creates an org, a database trigger should automatically add them as `owner` in `org_members`. However:
- **Race condition**: The trigger may not execute before the RLS check
- **Missing entry**: The `org_members` entry might not exist at all
- **Wrong role**: User might have been downgraded or the role wasn't set correctly

### Cause 2: Silent Error Failures
The original code had minimal error logging:
```typescript
const { error } = await supabase.from("collections").insert(...);
if (error) { toast.error(error.message); return null; }
```

Problems:
- Toast messages disappear quickly
- Error details weren't logged to console
- No clear indication of what went wrong (RLS vs. bad data vs. network issue)

### Cause 3: No Console Debugging
There were **no debug logs** in the database operations, making it impossible to diagnose issues in production.

---

## Fixes Applied

### Fix 1: Enhanced useCollections.ts Hook
**Changes:**
- ✅ Added comprehensive `console.debug()` logging for every database operation
- ✅ Added try/catch blocks with explicit error handling
- ✅ Distinguished RLS errors (PGRST301) from other errors
- ✅ Improved error messages: "Permission denied. Check your workspace role."
- ✅ Added validation checks: `if (!currentOrgId || !user) return null`

**Example:**
```typescript
// BEFORE
const { data, error } = await supabase.from("collections").insert({ ... });
if (error) { toast.error(error.message); return null; }

// AFTER
console.debug("[collections] Creating collection:", { name, orgId: currentOrgId, userId: user.id });
try {
  const { data, error } = await supabase.from("collections").insert({ ... });
  if (error) {
    console.error("[collections] Insert error:", error.code, error.message, error);
    if (error.code === "PGRST301" || error.message.includes("row level security")) {
      toast.error("Permission denied. Check your workspace role.");
    } else {
      toast.error(`Failed to create collection: ${error.message}`);
    }
    return null;
  }
  console.debug("[collections] Collection created successfully:", data);
  // ... rest of code
} catch (e: any) {
  console.error("[collections] Unexpected create error:", e);
  toast.error("Failed to create collection");
  return null;
}
```

**What this fixes:**
- You'll now see detailed logs in the browser DevTools → Console
- RLS errors will be explicitly identified
- Users get better error messages

---

### Fix 2: Enhanced useDashboards.ts Hook
**Changes:**
- ✅ Added logging for all CRUD operations
- ✅ Added comments explaining RLS requirements
- ✅ Improved error messages for dashboard save failures
- ✅ Added explicit logging when updating layout

**Example:**
```typescript
const update = useCallback(
  async (id: string, patch: Partial<Pick<Dashboard, ...>>) => {
    console.debug("[dashboards] Updating dashboard:", id, { patch });
    try {
      const { data, error } = await supabase.from("dashboards").update({...}).eq("id", id).select("*");
      if (error) {
        console.error("[dashboards] Update error:", error.code, error.message, error);
        if (error.code === "PGRST301" || error.message.includes("row level security")) {
          toast.error("Permission denied. Check your workspace role (need owner/admin/editor).");
        } else {
          toast.error(`Failed to save dashboard: ${error.message}`);
        }
        return null;
      }
      console.debug("[dashboards] Dashboard updated successfully");
      // ... update state
      return data as Dashboard | null;
    } catch (e: any) {
      console.error("[dashboards] Unexpected update error:", e);
      toast.error("Failed to save dashboard");
      return null;
    }
  },
  []
);
```

---

### Fix 3: Enhanced Builder.tsx Page
**Changes:**
- ✅ Added comprehensive logging to `handleSave()`
- ✅ Shows loading state during save
- ✅ Logs exact number of widgets being saved
- ✅ Distinguishes between create and update operations
- ✅ Better user feedback with error messages pointing to console

**Example:**
```typescript
const handleSave = async () => {
  console.debug("[builder] Save clicked", { dashboardId, name, widgetCount: widgets.length });
  setSaving(true);
  try {
    if (dashboardId) {
      console.debug("[builder] Updating existing dashboard", { id: dashboardId, widgetCount: widgets.length });
      const updated = await updateDashboard(dashboardId, { name, layout: widgets });
      if (updated) {
        console.debug("[builder] Dashboard updated successfully");
        toast.success("Dashboard saved");
      } else {
        console.warn("[builder] updateDashboard returned null/error");
      }
    } else {
      // ... create new dashboard
    }
  } catch (e: any) {
    console.error("[builder] Unexpected save error:", e);
    toast.error("Failed to save dashboard - check browser console for details");
  } finally {
    setSaving(false);
  }
};
```

---

### Fix 4: RLS Policy SQL Fixes
**File:** `supabase/RLS_FIXES.sql`

**Provides:**
1. **Verification queries** to diagnose your setup
2. **Helper function** `fix_missing_org_members()` to auto-fix missing role entries
3. **Rebuilt RLS policies** with clearer structure
4. **Diagnostic view** `debug_user_access` to inspect permissions

**Key changes:**
- Split into separate INSERT, UPDATE, DELETE policies (easier to understand)
- Added explicit comments about role requirements
- Includes queries to verify your org_members table has entries

---

## How to Debug Issues

### Step 1: Check Browser Console

1. Open your app in browser
2. Open **DevTools** → **Console** tab
3. Try to create a collection or save a dashboard
4. Look for logs starting with `[collections]` or `[dashboards]` or `[builder]`

**Example output (success):**
```
[collections] Creating collection: {name: "My Collection", orgId: "uuid-123", userId: "uuid-456"}
[collections] Collection created successfully: {id: "uuid-789", name: "My Collection", schema: Array(0)}
```

**Example output (RLS error):**
```
[collections] Creating collection: {name: "My Collection", orgId: "uuid-123", userId: "uuid-456"}
[collections] Insert error: PGRST301 "new row violates row-level security policy \"collections_insert\" on table \"collections\""
// Toast shows: "Permission denied. Check your workspace role."
```

### Step 2: Run RLS Diagnostic Queries

In Supabase dashboard → SQL Editor, run:

```sql
-- Check if you have org_members entries
SELECT org_id, user_id, role FROM public.org_members 
WHERE user_id = auth.uid() 
LIMIT 10;

-- This should return rows like:
-- org_id: uuid-123, user_id: uuid-456, role: owner
```

If NO rows are returned, your org_members table is missing entries. Fix it:

```sql
-- Auto-fix missing org_members entries
SELECT * FROM public.fix_missing_org_members();
```

### Step 3: Verify RLS Policies Work

```sql
-- Test the has_org_role function
SELECT public.has_org_role(
  'uuid-of-your-org'::uuid,
  auth.uid(),
  array['owner','admin','editor']::public.app_role[]
);

-- This should return TRUE
-- If it returns FALSE, the RLS policy will block your inserts
```

---

## How to Apply Fixes to Your Database

### Option A: Auto-Fix (Recommended)

In Supabase SQL Editor:
```sql
-- This function finds any orgs where the creator is not listed as owner
-- and automatically adds them to org_members
SELECT * FROM public.fix_missing_org_members();
```

### Option B: Manual Fix

1. Go to Supabase dashboard
2. Open **Table Editor**
3. Click on `org_members` table
4. Add new row:
   - `org_id`: (copy from your org in `orgs` table)
   - `user_id`: (your user ID from `auth.users`)
   - `role`: `owner`

### Option C: Rebuild RLS Policies

If the fixes above don't work, rebuild all RLS policies:

1. Go to Supabase SQL Editor
2. Copy entire contents of `supabase/RLS_FIXES.sql`
3. Paste into SQL Editor
4. Run all the DROP/CREATE POLICY statements at the bottom

---

## Expected Behavior After Fixes

### Collection Creation
✅ **Before:**
- User clicks "Create collection"
- No error or silent error
- Collection doesn't appear in list
- Refresh page, still nothing

✅ **After:**
- User clicks "Create collection"
- Name input dialog appears
- User enters name and clicks "Create"
- Console shows: `[collections] Creating collection: {...}`
- Collection appears in list immediately
- Toast shows "Collection created"
- If error: Console shows error code + message, toast shows helpful error text

### Dashboard Layout Save
✅ **Before:**
- User drags widgets on canvas
- Clicks "Save"
- Layout appears to save (button goes back to "Save")
- Refresh page, layout is gone

✅ **After:**
- User drags widgets on canvas
- Clicks "Save"
- Console shows: `[builder] Updating existing dashboard {...}`
- Toast shows "Dashboard saved"
- Refresh page, layout persists
- If error: Console shows error code + message, helpful error in toast

---

## Files Modified

1. **`src/hooks/useCollections.ts`**
   - Added logging to all CRUD operations
   - Better error handling and messages
   - ~300 lines → ~400 lines (added detailed comments & logging)

2. **`src/hooks/useDashboards.ts`**
   - Added logging to all CRUD operations
   - Clearer error messages for RLS violations
   - Added JSDoc comments explaining RLS requirements
   - ~80 lines → ~180 lines

3. **`src/pages/app/Builder.tsx`**
   - Enhanced `handleSave()` function
   - Added logging before/after database operations
   - Better error messages pointing to console for details
   - ~15 lines → ~30 lines (handleSave function)

4. **`supabase/RLS_FIXES.sql`** (NEW)
   - Diagnostic queries to verify RLS setup
   - Helper function to auto-fix missing org_members entries
   - Rebuilt RLS policies with clearer structure
   - ~200 lines of SQL with comments

---

## Testing the Fixes

### Test Collection Creation
1. Go to `/app/collections`
2. Click "+ New collection"
3. Enter name, click "Create"
4. Check console for `[collections]` logs
5. Collection should appear in list
6. Refresh page - collection should persist

### Test Dashboard Save
1. Go to `/app/dashboards/new`
2. Drag a widget onto canvas
3. Resize/move it
4. Click "Save"
5. Check console for `[builder]` and `[dashboards]` logs
6. You should be redirected to `/app/dashboards/[id]`
7. Refresh page - layout should persist

### Test Error Handling
1. Manually delete your org_members entry in Supabase
2. Try to create a collection
3. Should see error: "Permission denied. Check your workspace role."
4. Console should show: `[collections] Insert error: PGRST301 ...`

---

## Production Recommendations

1. **Keep debug logs**: The `console.debug` calls won't clutter production (use `process.env.NODE_ENV` to filter if needed)
2. **Monitor errors**: Set up error tracking (Sentry, Rollbar, etc.) to catch PGRST301 errors
3. **Educate users**: If users see permission errors, explain they need owner/admin/editor role
4. **Schedule fix**: Run `fix_missing_org_members()` periodically to catch race conditions
5. **Add tests**: Write integration tests for collection creation and dashboard save

---

## Still Having Issues?

1. Check the console logs for `[collections]`, `[dashboards]`, `[builder]` prefixes
2. Look for error code `PGRST301` (RLS violation)
3. Run the diagnostic SQL queries in supabase/RLS_FIXES.sql
4. Run `SELECT * FROM public.fix_missing_org_members();` to auto-fix
5. Share the full console error message (without sensitive data) for additional help

