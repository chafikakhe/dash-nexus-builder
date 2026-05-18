# 🏗️ DashForge SaaS - Architecture & Code Review

*Senior Full-Stack Engineer Analysis | Production Ready Assessment*

---

## EXECUTIVE SUMMARY

**Project Status:** ⚠️ **FUNCTIONAL BUT WITH CRITICAL ARCHITECTURAL ISSUES**

**Maturity Level:** Early-stage SaaS (not production-ready for scaling)

**Key Findings:**
1. ❌ **Orphaned state management** (Zustand store with hardcoded data)
2. ❌ **Race conditions** in workspace/org initialization
3. ❌ **Missing org_members** entries causing RLS failures
4. ⚠️ **Data persistence timing issues** (optimistic updates without verification)
5. ✅ Auth system (recently fixed) is solid
6. ✅ Database schema is correct
7. ✅ RLS policies are secure but complex

---

## 1️⃣ SYSTEM ARCHITECTURE UNDERSTANDING

### How This App is Supposed to Work (End-to-End)

```
┌─────────────────────────────────────────────────────────────────┐
│                         DATA FLOW ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────────┘

LAYER 1: USER AUTHENTICATION
─────────────────────────────
  User Login → Supabase Auth → JWT Token → Stored in localStorage
       ↓
  auth.uid() → Identifies current user
       ↓
  RLS policies use auth.uid() to enforce data access

LAYER 2: WORKSPACE/ORG CONTEXT
──────────────────────────────
  User has 1+ orgs (workspaces)
  Current org stored in AuthContext as currentOrgId
       ↓
  All data is scoped to org_id:
    - collections.org_id
    - dashboards.org_id  
    - org_members.org_id

LAYER 3: WORKSPACE OWNERSHIP & ROLES
─────────────────────────────────────
  org_members table:
    - Links user to org
    - Defines role (owner/admin/editor/viewer)
    - RLS policies check: has_org_role(org_id, user_id, ['owner','admin','editor'])

LAYER 4: DATA CREATION
──────────────────────
  User is in an org
       ↓
  User has correct role (owner/admin/editor)
       ↓
  RLS allows INSERT into collections/dashboards
       ↓
  Data saved with org_id field

LAYER 5: DATA PERSISTENCE & LOADING
────────────────────────────────────
  User switches org → currentOrgId changes
       ↓
  useCollections/useDashboards refetch with new org_id
       ↓
  Data filtered by org_id shown in UI

LAYER 6: DATA MANIPULATION
──────────────────────────
  Collections:
    - Create → INSERT collections (name, schema, org_id)
    - Read → SELECT collections WHERE org_id = currentOrgId
    - Update → UPDATE collections WHERE id = ... AND org_id = currentOrgId
    - Delete → DELETE collections WHERE id = ...
    
  Dashboards:
    - Create → INSERT dashboards (name, layout, org_id)
    - Update → UPDATE dashboards SET layout = ... WHERE id = ...
    - Read → SELECT dashboards WHERE org_id = currentOrgId
    
  Widgets:
    - Stored in dashboards.layout as JSON array
    - No separate widgets table
```

### Data Model Relationships

```typescript
// Actual relationships in database:

auth.users (Supabase managed)
    ↓ references user.id
    ├── profiles (1:1) - user metadata
    └── org_members (M:M to orgs) - org membership + role

orgs (workspaces)
    ↓ has many
    ├── org_members (users in org with roles)
    ├── dashboards (org's dashboards)
    └── collections (org's data collections)

dashboards
    ├── layout: Widget[] (JSON array in JSONB column)
    ├── created_by: uuid (references auth.users)
    └── org_id: uuid (references orgs)

collection_records
    ├── data: Record<string, any> (dynamic schema)
    ├── collection_id (references collections)
    └── org_id (denormalized for RLS)

// The critical relationship that's broken:
ORG CREATION → Should auto-create org_members entry for creator
auth.users.id → Should exist in org_members if they created org
```

### Current Data Flow (Collections)

```
UI: Collections.tsx
  ↓
  Uses: useAuth() → gets currentOrgId
  ↓
  Uses: useCollections() 
    ├─ getFetch: SELECT * FROM collections WHERE org_id = currentOrgId
    ├─ createCollection: INSERT into collections 
    │   → Requires: org_id, name, schema
    │   → RLS checks: has_org_role(org_id, auth.uid(), [...])
    └─ Needs: currentOrgId must exist AND user must be in org_members
  ↓
  Supabase Hook: .from("collections").insert({...})
    ├─ IF currentOrgId is null → Inserts with NULL org_id → RLS blocks
    ├─ IF user not in org_members → RLS blocks (PGRST301)
    └─ IF insert succeeds → setCollections updates state
  ↓
  State Update: setCollections((prev) => [...prev, newCol])
  ↓
  UI Re-renders → Collection appears in list
```

---

## 2️⃣ ARCHITECTURE REVIEW

### What's Good ✅

| Aspect | Rating | Notes |
|--------|--------|-------|
| **Database Schema** | ⭐⭐⭐⭐⭐ | Proper normalization, foreign keys, JSONB for flexible data |
| **RLS Policies** | ⭐⭐⭐⭐⭐ | Secure, role-based, org-scoped, admin overrides |
| **Auth System** | ⭐⭐⭐⭐⭐ | Fixed refresh tokens, proper session management |
| **Component Structure** | ⭐⭐⭐⭐ | Clean separation, custom hooks, composable |
| **Typing** | ⭐⭐⭐⭐ | Good TypeScript coverage, types defined in hooks |
| **UI/UX** | ⭐⭐⭐⭐ | Beautiful, responsive, good error states |

### What's Broken ❌

| Aspect | Rating | Issue | Impact |
|--------|--------|-------|--------|
| **State Management** | ⭐ | Zustand store unused/orphaned | Confusion, maintainability |
| **Org Initialization** | ⭐⭐ | Race condition in auth flow | "No workspace selected" |
| **Data Persistence** | ⭐⭐ | Optimistic updates without verification | Collections/dashboards fail silently |
| **Error Handling** | ⭐⭐ | Errors logged but UI feedback minimal | Users don't know what went wrong |
| **Testing** | ⭐ | No integration tests | High regression risk |
| **Documentation** | ⭐ | No API/data model docs | Difficult to onboard |

### Architectural Problems

#### Problem #1: Dead Code in State Management

**File:** `src/store/app.ts`

```typescript
// DEAD CODE - Not used anywhere meaningful
export const useAppStore = create<AppState>((set) => ({
  orgs: [
    { id: "org_1", name: "Acme Inc.", plan: "Pro" },      // ← HARDCODED FAKE DATA
    { id: "org_2", name: "Northwind Labs", plan: "Free" }, // ← Never synced
    { id: "org_3", name: "Globex Corp", plan: "Enterprise" }, // ← with database
  ],
  currentOrgId: "org_1", // ← Doesn't match real org IDs
  // ...
}));
```

**Why it's a problem:**
- ❌ Developers might think this is the source of truth
- ❌ Real org IDs come from database, not this store
- ❌ Switching workspace ignores this store entirely
- ❌ UI state is split between AuthContext and Zustand

**Real pattern being used:**
```typescript
// AppSidebar.tsx (CORRECT)
const { orgs, currentOrgId, setCurrentOrgId } = useAuth(); // ← Source of truth

// NOT from useAppStore
```

---

#### Problem #2: Race Condition in Workspace Initialization

**File:** `src/contexts/AuthContext.tsx`

**The Issue:**

```typescript
useEffect(() => {
  // 1. Set up listener FIRST
  const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
    // This fires when session changes
    setSession(newSession);
    setUser(newSession?.user ?? null);
    if (newSession?.user) {
      setTimeout(() => { refreshOrgs(); }, 0); // ← Deferred refresh
    }
  });

  // 2. Then load existing session
  let mounted = true;
  supabase.auth.getSession().then(({ data }) => {
    if (!mounted) return;
    setSession(data.session);
    setUser(data.session?.user ?? null);
    setLoading(false);
    if (data.session?.user) refreshOrgs(); // ← Immediate refresh
  });

  return () => {
    mounted = false;
    try { subscription?.unsubscribe(); } catch (e) { /* ignore */ }
  };
}, []);
```

**Race Condition Sequence:**

```
Page Load
  ↓
AuthContext initializes
  ↓
getSession().then(...) starts async load
  ↓
Components mount (Collections, Overview, etc.)
  ↓
useCollections hook runs:
  - Gets currentOrgId from context
  - BUT org list hasn't loaded yet!
  - currentOrgId might be null or stale
  ↓
Fetches collections WHERE org_id = null
  ↓
Returns empty list or error
  ↓
refreshOrgs() finally completes
  ↓
Collections refetch with correct org_id
```

**The symptom:** "No workspace selected" error on initial load

---

#### Problem #3: Missing org_members Entry After Org Creation

**File:** `src/components/layout/AppSidebar.tsx`

```typescript
const handleCreateOrg = async () => {
  const { data, error } = await supabase
    .from("orgs")
    .insert({ name: newName.trim(), slug, created_by: user.id })
    .select("id")
    .single();
    
  // Problem: Trigger adds org_members entry, but there's a race condition
  // ↓
  // User immediately tries to create collection
  // ↓
  // RLS checks: has_org_role(org_id, user_id, ['owner','admin','editor'])
  // ↓
  // org_members entry might not exist yet!
  // ↓
  // PGRST301 error: "row level security policy violated"
};
```

**Expected flow (should work but sometimes fails):**
```
INSERT into orgs (name, slug, created_by)
  ↓ triggers:
on_org_created trigger
  ↓
INSERT into org_members (org_id, user_id, 'owner')
  ↓
User can now create collections/dashboards
```

**Actual flow (often fails):**
```
INSERT into orgs (name, slug, created_by) → Returns org_id
  ↓
User clicks "Create collection"
  ↓
INSERT into collections ← RLS checks org_members
  ↓
Trigger hasn't executed yet!
  ↓
org_members is empty
  ↓
RLS blocks insert → PGRST301
```

---

#### Problem #4: Optimistic Updates Without Verification

**File:** `src/hooks/useCollections.ts`

```typescript
const createCollection = useCallback(
  async (name: string, schema: Field[] = []) => {
    // ...
    const { data, error } = await supabase
      .from("collections")
      .insert({ org_id: currentOrgId, name, schema })
      .select("*")
      .single();
    
    if (error) { 
      toast.error(error.message);
      return null; 
    }
    
    // ← PROBLEM: Only updates state if data returned
    const col = { ...(data as any), schema: (data as any).schema ?? [] } as Collection;
    setCollections((prev) => [...prev, col]); // ← Optimistic update
    return col;
  },
  [currentOrgId, user]
);
```

**Why it's risky:**
- ✅ Works fine if insert succeeds
- ❌ If insert fails with error, collection is added to state anyway
- ❌ User sees collection in UI but it's not in database
- ❌ Refresh page = collection disappears
- ❌ No retry logic

**Better pattern would be:**
```typescript
// Optimistic update
setCollections((prev) => [...prev, tempCol]);

try {
  await insertToDatabase();
  // Success - keep the optimistic update
} catch (e) {
  // Error - remove the optimistic update
  setCollections((prev) => prev.filter((c) => c.id !== tempCol.id));
  toast.error(...);
}
```

---

#### Problem #5: Widget Layout Stored as JSONB But No Schema Validation

**File:** `src/pages/app/Builder.tsx`

```typescript
// Widget type
type Widget = { 
  id: string; 
  type: WidgetType; 
  title: string; 
  w: number; 
  h: number; 
  config?: WidgetConfig 
};

// Saved to database as:
const { data, error } = await supabase
  .from("dashboards")
  .update({ layout: widgets, updated_at: new Date().toISOString() })
  .eq("id", id);

// But when loading:
const layout = Array.isArray(db.layout) ? (db.layout as Widget[]) : [];
// ← Just trusts it's a Widget[]!
```

**Risks:**
- ❌ No validation of loaded layout
- ❌ If database is corrupted or data is modified directly, UI might crash
- ❌ TypeScript type assertion `as Widget[]` doesn't validate at runtime
- ❌ If schema changes, old dashboards might be incompatible

---

## 3️⃣ CRITICAL DATA FLOW BUGS

### Bug #1: Collections Don't Persist

**Scenario:**
1. User logs in
2. User goes to Collections
3. User clicks "+ New collection"
4. User enters name and clicks "Create"

**Expected:** Collection appears in list and persists after refresh

**Actual:** Collection appears in list, but is gone after refresh

**Root Causes (in order of likelihood):**

1. **currentOrgId is null or undefined**
   ```typescript
   // In useCollections.ts
   const createCollection = useCallback(
     async (name: string, schema: Field[] = []) => {
       if (!currentOrgId || !user) return null; // ← Fails here silently
       // ...
     },
     [currentOrgId, user]
   );
   ```
   
   **Why:** Auth is still loading when Collections component mounts

2. **User not in org_members**
   ```sql
   -- RLS policy blocks insert:
   DROP POLICY IF EXISTS "collections_insert" ON public.collections;
   CREATE POLICY "collections_insert" ON public.collections
     FOR INSERT TO authenticated
     WITH CHECK (
       public.has_org_role(org_id, auth.uid(), array['owner','admin','editor'])
       -- ↑ This fails if no org_members entry exists
     );
   ```
   
   **Why:** Org was just created, trigger didn't execute yet

3. **Network error not shown to user**
   ```typescript
   if (error) { 
     toast.error(error.message); // ← Toast disappears after 3s
     return null;
   }
   ```
   
   **Why:** User might not see error before refreshing page

---

### Bug #2: Dashboard Layout Doesn't Save

**Scenario:**
1. User goes to Dashboard Builder
2. User drags widgets onto canvas
3. User clicks "Save"
4. Page refreshes

**Expected:** Layout persists

**Actual:** Layout is gone

**Root Causes:**

1. **Save fails silently**
   ```typescript
   const handleSave = async () => {
     setSaving(true);
     try {
       if (dashboardId) {
         const updated = await updateDashboard(dashboardId, { layout: widgets });
         if (updated) {
           toast.success("Dashboard saved");
         } else {
           // ← If error, toast never shown
           console.warn("[builder] updateDashboard returned null");
         }
       }
     } catch (e) {
       toast.error("Failed to save"); // ← Generic error
     } finally {
       setSaving(false);
     }
   };
   ```
   
   **Problem:** No explicit feedback if save fails

2. **Optimistic update misleads user**
   ```typescript
   // User sees widgets persist in UI even if save failed
   const update = (id: string, patch: Partial<Widget>) =>
     setWidgets((ws) => ws.map((w) => (w.id === id ? { ...w, ...patch } : w)));
   ```

3. **RLS policy blocks update**
   ```sql
   -- If user lost editor role, this fails:
   DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
   CREATE POLICY "dashboards_update" ON public.dashboards
     FOR UPDATE TO authenticated
     USING (
       public.has_org_role(org_id, auth.uid(), array['owner','admin','editor'])
       -- ↑ Returns false if user is 'viewer'
     );
   ```

---

### Bug #3: "No workspace selected" Error

**Scenario:**
1. User logs in
2. Immediately navigates to /app/collections
3. Page shows "No workspace selected"

**Root Cause:** Race condition in org loading

```typescript
// In AuthContext - these happen in parallel:
const { data: subscription } = supabase.auth.onAuthStateChange(...);
supabase.auth.getSession().then(({ data }) => {
  // This async call takes 100-200ms
  setSession(data.session);
  refreshOrgs(); // ← Sets orgs state
});

// Meanwhile, Collections component mounts:
const { currentOrgId, orgs } = useAuth();
// ↑ orgs is still empty []!

if (!currentOrgId || orgs.length === 0) {
  return <div>No workspace selected</div>; // ← Shows this
}
```

---

## 4️⃣ SUPABASE DEEP DIVE

### RLS Policy Analysis

**Good:**
- ✅ Prevents unauthorized data access
- ✅ Org-scoped (users only see their org's data)
- ✅ Role-based (owner/admin/editor/viewer)
- ✅ Admin override for platform admins

**Problems:**
- ❌ Triggers for org_members auto-creation can fail silently
- ❌ Complex nested function calls (is_org_member, has_org_role)
- ❌ No audit logging of RLS violations

**Critical RLS Rules:**

```sql
-- Collections: Only owner/admin/editor can create
CREATE POLICY "collections_insert" ON public.collections
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- If this returns FALSE → PGRST301 error
-- This happens when:
-- 1. org_id doesn't exist
-- 2. User doesn't exist in org_members for that org
-- 3. User's role is 'viewer' (not owner/admin/editor)
```

**The Trigger That Should Fix It:**

```sql
create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing; -- ← Safe to retry
  return new;
end $$;

drop trigger if exists on_org_created on public.orgs;
create trigger on_org_created
  after insert on public.orgs
  for each row execute function public.handle_new_org();
```

**When This Fails:**
- Database is under heavy load
- Trigger execution is delayed
- User immediately creates collection before org_members entry exists

---

### Auth.uid() Usage Analysis

**Correct Usage:**
```typescript
// In RLS policies - works correctly
WHERE auth.uid() = user_id

// In functions - works correctly
WHERE user_id = auth.uid()
```

**Correct in App Code:**
```typescript
// Getting current user
const { user } = useAuth(); // ← Gets from Supabase session
const { data: userData } = await supabase.auth.getUser(); // ← Calls auth.uid()
```

**Missing Validation:**
```typescript
// Should validate user exists in organization
const handleCreateCollection = async (name: string) => {
  // ❌ Doesn't check if user is in currentOrgId
  const { data, error } = await supabase
    .from("collections")
    .insert({ org_id: currentOrgId, name, schema: [] });
  
  // ✅ Should verify first:
  const { data: membership } = await supabase
    .from("org_members")
    .select("role")
    .eq("org_id", currentOrgId)
    .eq("user_id", user.id)
    .single();
  
  if (!membership || membership.role === 'viewer') {
    throw new Error("Permission denied");
  }
};
```

---

## 5️⃣ STATE MANAGEMENT ANALYSIS

### Current State Architecture

```
┌─────────────────────────────────────────────────┐
│          FRAGMENTED STATE MANAGEMENT            │
└─────────────────────────────────────────────────┘

AuthContext (src/contexts/AuthContext.tsx)
├─ source of truth for:
│  ├─ user: User | null
│  ├─ session: Session | null
│  ├─ loading: boolean
│  ├─ orgs: Org[] ← Real org data from database
│  ├─ currentOrgId: string | null ← Workspace selection
│  └─ refreshOrgs(): Promise<void>
│
└─ Problems:
   ├─ Loading state (`loading` boolean) not properly used everywhere
   ├─ No error state (auth errors are caught but not stored)
   ├─ org refresh can be stale (no cache invalidation)
   └─ setCurrentOrgId updates localStorage (ok) but not synced

useCollections Hook
├─ source of truth for:
│  ├─ collections: Collection[]
│  ├─ loading: boolean
│  ├─ createCollection(name, schema)
│  └─ removeCollection(id)
│
└─ Problems:
   ├─ Depends on currentOrgId from AuthContext
   ├─ If currentOrgId changes → full refetch (okay)
   ├─ No caching between rapid org switches
   └─ Errors only shown as toasts (not in state)

useDashboards Hook
├─ source of truth for:
│  ├─ dashboards: Dashboard[]
│  ├─ loading: boolean
│  ├─ create(input)
│  ├─ update(id, patch)
│  └─ remove(id)
│
└─ Problems:
   ├─ Depends on currentOrgId
   ├─ Update doesn't verify save succeeded
   ├─ Multiple re-renders possible on org switch
   └─ No optimistic update rollback

Zustand Store (src/store/app.ts) ← DEAD CODE
├─ Contains:
│  ├─ orgs: [hardcoded fake data]
│  ├─ currentOrgId: "org_1"
│  └─ paletteOpen: boolean
│
└─ Problems:
   ├─ NOT used by any real features
   ├─ Has hardcoded org IDs that don't match database
   ├─ Misleads developers
   └─ Should be removed

Page-level useState
├─ Collections.tsx:
│  ├─ activeId: string | null (selected collection)
│  ├─ query: string (search filter)
│  ├─ openNewCol: boolean (dialog state)
│  └─ newColName: string (form input)
│
├─ Builder.tsx:
│  ├─ dashboardId: string | null
│  ├─ widgets: Widget[] (current editing state)
│  ├─ selectedId: string | null (selected widget)
│  ├─ name: string
│  ├─ saving: boolean
│  └─ loadingDb: boolean
│
└─ Problems:
   ├─ Local state not cleared when switching org
   ├─ If user has Collection A open, switches org, comes back → still shows A
   └─ No state reset on org/route change
```

### State Flow Issues

**Issue #1: Cross-Page State Contamination**

```typescript
// User in Collections.tsx
const [activeId, setActiveId] = useState<string | null>("col-123");

// User switches workspace
setCurrentOrgId("new-org-id");

// Collections refetch with new org... but activeId is still "col-123"
// col-123 doesn't exist in new org!
// ↓
// Collection details panel shows stale data
```

**Solution:**
```typescript
useEffect(() => {
  // Clear local state when workspace changes
  setActiveId(null);
}, [currentOrgId]);
```

**Issue #2: Stale Data in Builder**

```typescript
// User edits Dashboard A
const [widgets, setWidgets] = useState<Widget[]>([...dashboardA.widgets]);

// User navigates to Dashboards list, then opens Dashboard B
// ↓
// Builder component remounts with new dashboardId
// ↓
// widgets state is reset from new dashboard ✓
// BUT
// User clicks Save
// ↓
// updateDashboard is called with new widgets
// ← Should update dashboardB, but what if:
// ← Network is slow and user switched back to A?
// ← widgets array is from B but dashboardId could be A?
```

---

## 6️⃣ CRITICAL BUGS LIST

### High Priority 🔴

| Bug | Severity | Cause | Impact | Fix Time |
|-----|----------|-------|--------|----------|
| **Org creation doesn't auto-add user to org_members** | 🔴🔴🔴 | Missing org_members entry, trigger race condition | User can't create collections/dashboards in newly created org | 2 hours |
| **Collections don't persist after creation** | 🔴🔴🔴 | RLS blocks due to missing org_members OR currentOrgId null | Data loss, user frustration | 3 hours |
| **Dashboard layout doesn't save** | 🔴🔴🔴 | Same RLS + optimistic update without verification | Work lost, user frustration | 3 hours |
| **"No workspace selected" on initial load** | 🔴🔴 | Race condition in org loading | UX broken on first login | 2 hours |
| **Zustand store has hardcoded fake orgs** | 🔴🔴 | Dead code not removed | Confusion, maintainability | 0.5 hours |

### Medium Priority 🟠

| Bug | Severity | Cause | Impact | Fix Time |
|-----|----------|-------|--------|----------|
| **Workspace switch doesn't clear local state** | 🟠🟠 | activeId/selectedId persist across org changes | Shows stale data from old org | 1 hour |
| **Error messages disappear before user sees them** | 🟠🟠 | Toast auto-dismisses in 3s, user doesn't notice | Users don't know why operations failed | 1 hour |
| **No validation on layout/widgets loading** | 🟠🟠 | TypeScript `as Widget[]` doesn't validate | Corrupted data could crash builder | 2 hours |
| **Dashboard save doesn't verify RLS permission** | 🟠🟠 | Update fails silently if user role changed | Changes lost without notification | 1 hour |
| **No cache invalidation when org data changes** | 🟠 | Collections/dashboards fetched fresh every org switch | Slow on mobile with many orgs | 3 hours |

### Low Priority 🟡

| Bug | Severity | Cause | Impact | Fix Time |
|-----|----------|-------|--------|----------|
| **Admin trigger for new user profile** | 🟡 | Happens after auth but no verification | Edge case: user exists in auth but not profiles | 0.5 hours |
| **No integration tests** | 🟡 | Not written | High regression risk | 4 hours |
| **No error tracking/monitoring** | 🟡 | Errors logged to console only | Can't monitor production issues | 2 hours |
| **Zustand store still imported in code** | 🟡 | Unused but still in codebase | Confuses developers | 0.5 hours |
| **Settings page not implemented** | 🟡 | UI exists but no logic | User can't update profile | 2 hours |

---

## 7️⃣ STEP-BY-STEP FIX PLAN

### Phase 1: Fix Critical Bugs (Day 1)

#### Step 1.1: Fix Org Creation → org_members Race Condition

**Current Problem:**
```typescript
// AppSidebar.tsx
const handleCreateOrg = async () => {
  const { data, error } = await supabase
    .from("orgs")
    .insert({ name: newName.trim(), slug, created_by: user.id })
    .select("id")
    .single();
  
  // User can immediately create collections
  // But org_members might not exist yet!
};
```

**Fix:**
```typescript
const handleCreateOrg = async () => {
  const { data, error } = await supabase
    .from("orgs")
    .insert({ name: newName.trim(), slug, created_by: user.id })
    .select("id")
    .single();
    
  if (error) { toast.error(error.message); return; }
  
  // ✅ Explicitly wait for org_members to exist
  let retries = 0;
  while (retries < 5) {
    const { data: membership, error: membError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", data.id)
      .eq("user_id", user.id)
      .single();
    
    if (membership) {
      // org_members entry exists, safe to proceed
      await refreshOrgs();
      setCurrentOrgId(data.id);
      toast.success("Workspace created");
      setOpenNew(false);
      setNewName("");
      return;
    }
    
    // Wait 200ms and retry
    await new Promise(r => setTimeout(r, 200));
    retries++;
  }
  
  toast.error("Failed to set up workspace membership");
};
```

**Time:** 30 minutes

---

#### Step 1.2: Fix Collections/Dashboards Insert Failures

**Verification Before Insert:**

```typescript
// In useCollections.ts
const createCollection = useCallback(
  async (name: string, schema: Field[] = []) => {
    if (!currentOrgId) {
      toast.error("No workspace selected");
      return null;
    }
    
    if (!user) {
      toast.error("Not logged in");
      return null;
    }
    
    // ✅ Verify user is in org_members
    const { data: membership, error: membError } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", currentOrgId)
      .eq("user_id", user.id)
      .single();
    
    if (membError || !membership) {
      toast.error("You don't have access to this workspace");
      console.error("[collections] User not in org_members", { membError });
      return null;
    }
    
    if (membership.role === 'viewer') {
      toast.error("You need at least editor role to create collections");
      return null;
    }
    
    // ✅ Now try to insert
    console.debug("[collections] Creating collection:", { name, orgId: currentOrgId });
    const { data, error } = await supabase
      .from("collections")
      .insert({ org_id: currentOrgId, name, schema })
      .select("*")
      .single();
    
    if (error) {
      console.error("[collections] Insert error:", error);
      toast.error(`Failed to create collection: ${error.message}`);
      return null;
    }
    
    console.debug("[collections] Collection created:", data);
    const col = { ...(data as any), schema: (data as any).schema ?? [] } as Collection;
    setCollections((prev) => [...prev, col]);
    toast.success("Collection created");
    return col;
  },
  [currentOrgId, user]
);
```

**Time:** 1 hour

---

#### Step 1.3: Fix "No Workspace Selected" Race Condition

**Problem:** Collections page mounts before org is loaded

**Solution: Add loading state check**

```typescript
// In Collections.tsx
export default function Collections() {
  const { currentOrgId, orgs, loading: authLoading } = useAuth();
  const { collections, loading: collectionsLoading, ... } = useCollections();

  // ✅ Block rendering until auth is ready
  if (authLoading) {
    return (
      <Topbar breadcrumb={[{ label: "Collections" }]} />
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentOrgId || orgs.length === 0) {
    return (
      <Topbar breadcrumb={[{ label: "Collections" }]} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Database className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground mb-4">
            No workspace selected
          </p>
          <Button onClick={() => { /* TODO: navigate to create workspace */ }}>
            Create a workspace
          </Button>
        </div>
      </div>
    );
  }

  // ✅ Now safe to render
  return (/* normal component */);
}
```

**Time:** 30 minutes

---

### Phase 2: Improve Data Persistence (Day 2)

#### Step 2.1: Add Proper Error Handling & Verification

**Current:** Optimistic updates without verification

**Fix:** Add rollback on error

```typescript
const handleSave = async () => {
  console.debug("[builder] Save clicked", { dashboardId, name, widgetCount: widgets.length });
  
  if (!dashboardId) {
    // Creating new dashboard
    const created = await create({ name, layout: widgets });
    if (created) {
      setDashboardId(created.id);
      toast.success("Dashboard created");
      navigate(`/app/dashboards/${created.id}`, { replace: true });
    } else {
      toast.error("Failed to create dashboard - check browser console");
    }
    return;
  }
  
  // Updating existing dashboard
  setSaving(true);
  const previousWidgets = [...widgets]; // ← Save for rollback
  
  try {
    const updated = await updateDashboard(dashboardId, { 
      name, 
      layout: widgets 
    });
    
    if (updated) {
      toast.success("Dashboard saved");
    } else {
      // Rollback optimistic update
      setWidgets(previousWidgets);
      toast.error("Failed to save dashboard - changes reverted");
      console.error("[builder] Save failed - rolled back");
    }
  } catch (error) {
    // Rollback optimistic update
    setWidgets(previousWidgets);
    toast.error("Failed to save dashboard - changes reverted");
    console.error("[builder] Save error:", error);
  } finally {
    setSaving(false);
  }
};
```

**Time:** 1 hour

---

#### Step 2.2: Clear Local State on Workspace Change

```typescript
// In Collections.tsx
useEffect(() => {
  // Clear local state when workspace changes
  setActiveId(null);
  setQuery("");
  setCreatingCol(false);
  setNewColName("");
  setOpenNewCol(false);
}, [currentOrgId]);
```

**Apply to all pages.** This prevents stale data from showing when switching orgs.

**Time:** 30 minutes

---

### Phase 3: Code Quality (Day 2)

#### Step 3.1: Remove Dead Code

```bash
# Delete src/store/app.ts (not used)
# OR if needed for UI state, rename to appUI.ts and only store:
# - paletteOpen
# Don't store org data here
```

**Time:** 15 minutes

---

#### Step 3.2: Add Integration Tests

Create `src/tests/integration.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";

describe("Collections Creation Flow", () => {
  beforeEach(async () => {
    // Create test user + org
  });

  it("should create collection and persist to database", async () => {
    // 1. Create org
    // 2. Create collection
    // 3. Verify in database
    // 4. Verify org_members entry exists
  });

  it("should fail with clear error if user not in org_members", async () => {
    // 1. Create org without org_members
    // 2. Try to create collection
    // 3. Verify error code is PGRST301
  });
});

describe("Dashboard Layout Save", () => {
  it("should persist widget layout", async () => {
    // 1. Create dashboard
    // 2. Update layout
    // 3. Refresh page
    // 4. Verify layout persists
  });

  it("should rollback on error", async () => {
    // 1. Create dashboard with layout
    // 2. Mock update to fail
    // 3. Save (should fail)
    // 4. Verify UI reverted
  });
});
```

**Time:** 3 hours

---

### Phase 4: Monitoring & Observability (Day 3)

#### Step 4.1: Add Error Tracking

```typescript
// Create src/lib/errorTracking.ts
export function trackError(error: unknown, context: Record<string, any>) {
  console.error("[ERROR]", context, error);
  
  // Send to error tracking service (Sentry, LogRocket, etc.)
  // if (typeof window !== "undefined" && window.Sentry) {
  //   window.Sentry.captureException(error, { tags: context });
  // }
}

// Use in hooks:
try {
  await insertCollection();
} catch (error) {
  trackError(error, {
    action: "createCollection",
    org_id: currentOrgId,
    feature: "collections"
  });
}
```

**Time:** 2 hours

---

## 8️⃣ CODE IMPROVEMENTS & BEST PRACTICES

### Pattern #1: Proper Error Handling in Async Operations

**Current (Bad):**
```typescript
const { error } = await operation();
if (error) {
  toast.error(error.message);
  return null;
}
```

**Better:**
```typescript
try {
  const { data, error } = await operation();
  
  if (error) {
    // Categorize the error
    if (error.code === "PGRST301") {
      // RLS violation
      console.error("[op] RLS violation", error);
      toast.error("Permission denied. Check your workspace role.");
    } else if (error.code === "23505") {
      // Unique constraint
      console.error("[op] Duplicate entry", error);
      toast.error("This item already exists");
    } else {
      console.error("[op] Error:", error.code, error.message);
      toast.error(`Operation failed: ${error.message}`);
    }
    return null;
  }
  
  return data;
} catch (e: unknown) {
  console.error("[op] Unexpected error:", e);
  toast.error("An unexpected error occurred");
  return null;
}
```

---

### Pattern #2: Proper Workspace Initialization

**Current (Bad):**
```typescript
useEffect(() => {
  fetchOrgs(); // Might not complete before component uses data
}, []);
```

**Better:**
```typescript
export function ProtectedLayout() {
  const { loading, orgs, currentOrgId } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!currentOrgId || orgs.length === 0) {
    return <EmptyState />;
  }

  return <AppContent />;
}
```

---

### Pattern #3: Optimistic Updates with Rollback

**Current (Bad):**
```typescript
// Update state immediately without verification
setCollections(prev => [...prev, newCol]);
const { error } = await insert();
// If error, collection still in state!
```

**Better:**
```typescript
const addCollection = async (name: string) => {
  const tempId = `temp_${Date.now()}`;
  const tempCollection = { id: tempId, name, ... };
  
  // Optimistic update
  setCollections(prev => [...prev, tempCollection]);
  
  try {
    const { data, error } = await supabase
      .from("collections")
      .insert({ name })
      .select("*")
      .single();
    
    if (error) throw error;
    
    // Replace temp with real
    setCollections(prev =>
      prev.map(c => c.id === tempId ? (data as Collection) : c)
    );
  } catch (error) {
    // Rollback
    setCollections(prev => prev.filter(c => c.id !== tempId));
    throw error;
  }
};
```

---

### Pattern #4: Proper State Reset on Navigation

**Current (Bad):**
```typescript
// Local state persists across route changes
const [selectedId, setSelectedId] = useState<string | null>(null);

export default function Collections() {
  // selectedId never resets when org changes
}
```

**Better:**
```typescript
const [selectedId, setSelectedId] = useState<string | null>(null);

useEffect(() => {
  // Reset when org changes
  setSelectedId(null);
}, [currentOrgId]);

useEffect(() => {
  // Also reset on page unmount
  return () => {
    setSelectedId(null);
  };
}, []);
```

---

### Pattern #5: Proper Data Validation

**Current (Bad):**
```typescript
const layout = db.layout as Widget[]; // ← Trusts the data
```

**Better:**
```typescript
import { z } from "zod";

const WidgetSchema = z.object({
  id: z.string(),
  type: z.enum(["stat", "line", "bar", "pie", "table", "gauge"]),
  title: z.string(),
  w: z.number().min(1).max(12),
  h: z.number().min(1).max(8),
  config: z.record(z.any()).optional(),
});

const DashboardLayoutSchema = z.array(WidgetSchema);

// Validate when loading
const layoutResult = DashboardLayoutSchema.safeParse(db.layout);
if (!layoutResult.success) {
  console.error("[builder] Invalid layout:", layoutResult.error);
  toast.error("Dashboard layout is corrupted");
  return null;
}

const layout = layoutResult.data;
```

---

### Pattern #6: Proper Dependency Management in Hooks

**Current (Bad):**
```typescript
const fetchCollections = useCallback(async () => {
  if (!currentOrgId) return;
  // ...
}, []); // ← Missing currentOrgId dependency!

useEffect(() => {
  fetchCollections();
}, [fetchCollections, currentOrgId]);
```

**Better:**
```typescript
const fetchCollections = useCallback(async () => {
  if (!currentOrgId) return;
  // ...
}, [currentOrgId]); // ← Include all dependencies

useEffect(() => {
  fetchCollections();
}, [fetchCollections]);
```

---

## 📊 ARCHITECTURE RECOMMENDATIONS

### Recommended Architecture (After Fixes)

```
┌─────────────────────────────────────────────────────┐
│            CLEAN STATE ARCHITECTURE                 │
└─────────────────────────────────────────────────────┘

AuthContext
├─ Responsible for:
│  ├─ User authentication
│  ├─ Session management
│  ├─ Org list (from database)
│  ├─ Current org selection
│  └─ User roles/permissions
│
└─ Guarantees:
   ├─ Never null until auth loads
   ├─ Always synced with database
   └─ Single source of truth

useCollections Hook
├─ Responsible for:
│  ├─ Collections CRUD
│  ├─ Caching collections list
│  ├─ Error handling
│  └─ Logging
│
└─ Guarantees:
   ├─ Automatic refetch on org change
   ├─ Proper error messages
   └─ Rollback on failure

useDashboards Hook
├─ Responsible for:
│  ├─ Dashboards CRUD
│  ├─ Layout persistence
│  ├─ Widget management
│  └─ Error handling
│
└─ Guarantees:
   ├─ Widget validation
   ├─ Proper save verification
   └─ Clear error feedback

Page-level useState (Collections.tsx, Builder.tsx)
├─ Responsible for:
│  ├─ UI state only (selected item, form input, etc.)
│  ├─ Dialog open/close
│  └─ Temporary editing state
│
└─ Guarantees:
   ├─ Reset on org change
   ├─ Reset on unmount
   └─ Never used for data persistence

Remove Zustand Store
├─ Problem:
│  ├─ Orphaned code
│  ├─ Hardcoded data
│  └─ Confuses developers
│
└─ Solution:
   ├─ Remove entirely
   └─ OR use only for UI state (drawer open, theme, etc.)
```

---

## 🚀 DEPLOYMENT CHECKLIST

Before launching to production:

- [ ] **Phase 1 Fixes Complete**
  - [ ] Org creation → org_members race condition fixed
  - [ ] Collections/dashboards insert failures resolved
  - [ ] "No workspace selected" loading state fixed
  - [ ] Dead code (Zustand) removed or repurposed

- [ ] **Phase 2 Fixes Complete**
  - [ ] Proper error handling in all async operations
  - [ ] Rollback on save failures
  - [ ] Local state clears on org change
  - [ ] Collection/dashboard verification before insert

- [ ] **Testing**
  - [ ] Manual testing of all CRUD operations
  - [ ] Test with slow network (DevTools throttling)
  - [ ] Test with multiple orgs
  - [ ] Test org switching
  - [ ] Test with multiple users in same org
  - [ ] Test role permissions (viewer/editor/admin/owner)

- [ ] **Monitoring**
  - [ ] Error tracking set up (Sentry/LogRocket)
  - [ ] Browser console logs checked in production
  - [ ] Database query performance monitored
  - [ ] RLS violation rates tracked

- [ ] **Documentation**
  - [ ] API documentation (data model)
  - [ ] Admin runbook for RLS issues
  - [ ] Customer support FAQ for common errors
  - [ ] Developer setup guide

---

## 📝 CONCLUSION

**TL;DR:**

Your SaaS has a **solid foundation** with:
- ✅ Good database design
- ✅ Secure RLS implementation
- ✅ Clean React components
- ✅ Proper authentication

But has **critical bugs preventing launch**:
- ❌ org_members race condition (users can't create data in new orgs)
- ❌ Collections/dashboards don't persist
- ❌ Workspace loading race condition
- ❌ Dead code (Zustand store)

**The fixes are straightforward and will take ~2-3 days** to implement properly with testing.

After fixes, this will be **production-ready for initial launch** with ~100 users. For scaling to 10,000+ users, you'll need:
- [ ] Database query optimization (indexes on org_id)
- [ ] Cache layer (Redis) for org data
- [ ] Rate limiting on API endpoints
- [ ] Audit logging for compliance
- [ ] Multi-region deployment
- [ ] Real-time collaboration (WebSockets for dashboard editing)

