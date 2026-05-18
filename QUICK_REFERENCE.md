# 🎯 Quick Reference: Critical Bugs & Fixes

## Your App Status

**Maturity:** Early-stage SaaS (functional but not production-ready)

**Main Issues:** 3 critical, 4 medium, 5 low priority bugs

**Time to Fix:** 2-3 days with proper testing

---

## 🔴 TOP 3 CRITICAL BUGS

### 1. Collections Don't Save to Database

**Symptom:** Collection appears in UI, disappears after refresh

**Root Cause:** 
- ❌ `currentOrgId` is null when component mounts
- ❌ User missing from `org_members` table (RLS blocks insert)

**Quick Fix:**
```typescript
// In useCollections.ts - add before insert
if (!currentOrgId || !user) {
  toast.error("Workspace not ready");
  return null;
}

// Verify user is in org_members
const { data: membership } = await supabase
  .from("org_members")
  .select("role")
  .eq("org_id", currentOrgId)
  .eq("user_id", user.id)
  .single();

if (!membership) {
  toast.error("You don't have access to this workspace");
  return null;
}

// Now safe to insert
```

**Test:** Create collection → Refresh → Collection should still exist

---

### 2. Dashboard Layout Doesn't Save

**Symptom:** Drag widgets, click Save, refresh = widgets gone

**Root Cause:**
- ❌ Save fails silently
- ❌ No error shown to user
- ❌ RLS policy blocks update (or user lost permission)

**Quick Fix:**
```typescript
const handleSave = async () => {
  setSaving(true);
  try {
    const updated = await updateDashboard(dashboardId, { 
      name, 
      layout: widgets 
    });
    
    if (!updated) {
      toast.error("Failed to save - check browser console");
      return; // Don't navigate
    }
    
    toast.success("Dashboard saved");
    navigate(...);
  } catch (error) {
    toast.error("Failed to save - " + error.message);
    console.error("[builder] save error:", error);
  } finally {
    setSaving(false);
  }
};
```

**Test:** Edit dashboard → Save → Refresh → Changes persist

---

### 3. "No Workspace Selected" on Initial Login

**Symptom:** Load app → blank page → "No workspace selected"

**Root Cause:** Race condition - orgs loading async, but Collections page mounts immediately

**Quick Fix:**
```typescript
export default function Collections() {
  const { currentOrgId, loading: authLoading } = useAuth();
  
  // ✅ Wait for auth to finish loading
  if (authLoading) {
    return <LoadingSpinner />;
  }
  
  if (!currentOrgId) {
    return <CreateWorkspacePrompt />;
  }
  
  // Now render normally
  return <CollectionsList />;
}
```

**Test:** Log in → Should see Collections page (not "No workspace selected")

---

## 🟠 MEDIUM PRIORITY (Do These After)

1. **Workspace switch doesn't clear local state** - Clear `activeId`/`selectedId` on `currentOrgId` change
2. **Error messages disappear too fast** - Increase toast duration to 5s
3. **No validation on widget layout** - Use Zod to validate dashboard.layout
4. **Zustand store has fake data** - Remove unused hardcoded orgs

---

## 💡 CODE IMPROVEMENTS

### 1. Add Logging
```typescript
console.debug("[collections] Creating:", { name, orgId: currentOrgId });
// Helps debug issues in browser console
```

### 2. Proper Error Handling
```typescript
if (error.code === "PGRST301") {
  // RLS violation - show specific message
  toast.error("Permission denied. Check your workspace role.");
} else if (error.code === "23505") {
  // Duplicate entry
  toast.error("This item already exists");
} else {
  // Generic error
  toast.error(error.message);
}
```

### 3. Reset State on Org Change
```typescript
useEffect(() => {
  setActiveId(null);
  setSelectedId(null);
  setQuery("");
}, [currentOrgId]); // Reset when org changes
```

---

## 📋 IMPLEMENTATION ORDER

### Day 1 (2-3 hours)
- [ ] Fix org_members race condition (AppSidebar.tsx)
- [ ] Add currentOrgId verification to useCollections
- [ ] Fix "No workspace selected" loading state
- [ ] Remove/fix Zustand store

### Day 2 (2-3 hours)
- [ ] Add proper error categorization (PGRST301 detection)
- [ ] Add rollback on save failures
- [ ] Clear local state on org change
- [ ] Increase toast duration

### Day 3 (2-3 hours)
- [ ] Write integration tests
- [ ] Manual testing of all flows
- [ ] Set up error tracking (optional)

---

## 🧪 TESTING CHECKLIST

After each fix, test:

- [ ] **Create Collection**
  - [ ] Create new collection
  - [ ] Refresh page - collection still there
  - [ ] Switch workspace - collection gone (expected)
  - [ ] Switch back - collection there (expected)

- [ ] **Save Dashboard**
  - [ ] Create new dashboard
  - [ ] Add widgets
  - [ ] Click Save
  - [ ] Refresh page - layout persists
  - [ ] Edit widget - click Save - persists

- [ ] **Workspace Creation**
  - [ ] Create new workspace
  - [ ] Immediately create collection - should work (not PGRST301)
  - [ ] Immediately create dashboard - should work

- [ ] **Load App**
  - [ ] Log in
  - [ ] Should see workspace with collections/dashboards
  - [ ] NOT "No workspace selected"

- [ ] **Switch Workspace**
  - [ ] Have multiple workspaces
  - [ ] Switch between them
  - [ ] Collections list updates correctly
  - [ ] Dashboards list updates correctly
  - [ ] No stale data from previous workspace

---

## 🔍 HOW TO FIND BUGS IN BROWSER

1. Open DevTools: **F12**
2. Go to **Console** tab
3. Look for logs starting with:
   - `[collections]` - collection operations
   - `[dashboards]` - dashboard operations
   - `[auth]` - authentication
4. Look for errors:
   - `PGRST301` = RLS policy blocked
   - `23505` = Unique constraint violation
   - `PGRST103` = Invalid auth token

**Example output:**
```
[collections] Creating collection: {name: "Customers", orgId: "uuid-123"}
[collections] Insert error: PGRST301 "row level security policy violated"
// ← User not in org_members!
```

---

## 📊 WHAT'S WORKING ✅

- ✅ Authentication (login/logout)
- ✅ Workspace switching (UI)
- ✅ Database design
- ✅ RLS policies (secure)
- ✅ UI/UX (beautiful)
- ✅ Drag & drop widgets (local)
- ✅ Admin panel (partially)

---

## 📚 FULL ANALYSIS

See `ARCHITECTURE_REVIEW.md` for:
- Complete system architecture
- All 9 bugs listed with details
- Code examples for each fix
- Best practices for SaaS patterns
- Deployment checklist
- Production recommendations

---

## 🎯 BOTTOM LINE

**Your app works locally but fails in production due to:**

1. **Org creation race condition** → Can't create data in new orgs
2. **Missing loading state checks** → Race condition on initial load
3. **No error verification** → Collections/dashboards appear to save but don't
4. **Dead code** → Zustand store confuses developers

**All fixable in 2-3 days.** After that, you'll have a solid SaaS ready for ~100 users.

For production launch (1000+ users), add:
- Query optimization (database indexes)
- Caching layer (Redis)
- Rate limiting
- Real-time collaboration
- Audit logging
