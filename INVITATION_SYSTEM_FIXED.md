# Invitation System - Fixed & Production-Ready

## Problem Analysis

You encountered: `"Could not find the function public.create_invitation(...) in the schema cache"`

### Root Causes:
1. **Function signature mismatch**: Parameters were named `_org` instead of `_org_id`
2. **RPC call mismatch**: Frontend was calling with `_org` but function expected different order
3. **PostgREST cache stale**: No schema cache reload signal was added after function updates
4. **Missing input validation**: Function lacked defensive checks for null values

---

## What Was Fixed

### 1. ✅ PostgreSQL Function (`supabase/schema.sql`)

**Changed parameter order to match RPC expectations:**

```sql
create or replace function public.create_invitation(
  _email text,           ← First parameter (was third)
  _org_id uuid,          ← Second parameter (was first, called _org)
  _role text,            ← Third parameter  
  _invited_by uuid,      ← Fourth parameter
  _dashboard_ids uuid[]  ← Fifth parameter (optional)
)
returns public.invitations
language plpgsql security definer set search_path = public
```

**Added improvements:**
- Input validation for null/empty values
- Better error messages with parameter context
- Email normalization (lowercase, trimmed)
- Explicit NULL array handling
- Inline documentation

**Enhanced `accept_invitation` function:**
- Added token validation
- Improved dashboard assignment (checks array length)
- Better error handling
- Comprehensive comments

### 2. ✅ Frontend RPC Call (`src/pages/app/Members.tsx`)

**Updated to match function signature:**

```typescript
const { data: insertedInvite, error } = await supabase.rpc("create_invitation", {
  _email: normalizedEmail,           // ← First parameter
  _org_id: currentOrgId,             // ← Second parameter (was _org)
  _role: inviteRole,                 // ← Third parameter
  _invited_by: user.id,              // ← Fourth parameter
  _dashboard_ids: inviteDashboardIds // ← Fifth parameter
});
```

### 3. ✅ PostgREST Schema Cache Signal (`supabase/schema.sql`)

**Added at end of schema file:**

```sql
-- Signal PostgREST to reload schema cache (fixes "Could not find the function" errors)
notify pgrst, 'reload schema';
```

This tells PostgREST to refresh its introspection cache when the schema is applied.

---

## How to Deploy

### In Supabase Dashboard:

1. **Go to:** SQL Editor
2. **Paste entire contents** of `supabase/schema.sql`
3. **Run the query** (will create all tables, functions, and policies)
4. **Wait 5-10 seconds** for PostgREST to refresh

### Verify It Worked:

1. **Check API Docs:**
   - Go to Supabase Dashboard → API Docs
   - Search for `create_invitation` under RPC section
   - Should show all 5 parameters with correct types

2. **Test in Dashboard:**
   ```sql
   SELECT public.create_invitation(
     _email := 'test@example.com',
     _org_id := (SELECT id FROM public.orgs LIMIT 1),
     _role := 'member',
     _invited_by := auth.uid(),
     _dashboard_ids := '{}'::uuid[]
   );
   ```

3. **Test in App:**
   - Go to Members page
   - Invite a team member
   - Should see success toast

---

## Function Specifications

### `create_invitation` Function

```sql
FUNCTION: public.create_invitation
INPUT PARAMETERS:
  _email           (text)      - Email address to invite (required)
  _org_id          (uuid)      - Organization/workspace ID (required)
  _role            (text)      - Role: 'member' or 'admin' (required)
  _invited_by      (uuid)      - Inviting user's ID (required)
  _dashboard_ids   (uuid[])    - Dashboard IDs to assign (optional, defaults to {})

RETURN TYPE:
  public.invitations (single row)
  {
    id: uuid,
    email: text,
    org_id: uuid,
    role: text,
    invited_by: uuid,
    status: 'pending',
    token: uuid,
    dashboard_ids: uuid[],
    created_at: timestamptz,
    accepted_at: null
  }

SECURITY:
  - SECURITY DEFINER (bypasses user RLS)
  - RLS policies still apply at table level
  - Only org owners/admins can create invitations (via RLS)

VALIDATION:
  - Rejects null/empty email
  - Rejects null org_id
  - Rejects null invited_by
  - Rejects duplicate pending invitations for same email+org
  - Auto-normalizes email (lowercase, trimmed)

BEHAVIOR:
  1. Validates all inputs
  2. Checks for duplicate pending invitations
  3. Inserts row into invitations table
  4. Auto-generates unique token
  5. Returns created invitation object
```

### `accept_invitation` Function

```sql
FUNCTION: public.accept_invitation
INPUT PARAMETERS:
  _token (text) - The invitation token sent in email

RETURN TYPE:
  TABLE(org_id uuid, user_id uuid, role app_role)

SECURITY:
  - SECURITY DEFINER (executes as schema owner)
  - Validates user email matches invitation email
  - Only works if invitation status = 'pending'

BEHAVIOR:
  1. Finds invitation by token
  2. Validates user is authenticated and email matches
  3. Adds user to org_members with specified role
  4. Assigns dashboard permissions if specified
  5. Marks invitation as 'accepted'
  6. Returns (org_id, user_id, role)

SIDE EFFECTS:
  - Creates org_members row
  - Creates dashboard_permissions rows
  - Updates invitation status and accepted_at timestamp
```

---

## Complete RPC Example

### Creating an Invitation

```typescript
// From Members.tsx
const { data: invitation, error } = await supabase.rpc("create_invitation", {
  _email: "teammate@company.com",
  _org_id: currentOrgId,
  _role: "member",
  _invited_by: user.id,
  _dashboard_ids: ["dashboard-1-uuid", "dashboard-2-uuid"]
});

if (error) {
  console.error("Failed to create invitation:", error);
  toast.error(error.message);
} else {
  console.log("Invitation created:", invitation);
  const inviteLink = `${window.location.origin}/invite/${invitation.token}`;
  await sendInviteEmail("teammate@company.com", workspaceName, inviteLink);
}
```

### Accepting an Invitation

```typescript
// From Notifications.tsx (or Invite.tsx)
const { data, error } = await supabase.rpc("accept_invitation", {
  _token: invitationToken
});

if (error) {
  console.error("Failed to accept invitation:", error);
  toast.error(error.message);
} else {
  console.log("Invitation accepted, user added to org:", data);
  // User now has access to org_members entry with specified role
  // User now has access to assigned dashboards via dashboard_permissions
}
```

---

## Parameter Name Reference

| Parameter | Type | Required | Notes |
|-----------|------|----------|-------|
| `_email` | text | Yes | Email address to invite |
| `_org_id` | uuid | Yes | Organization ID (NOT `_org`) |
| `_role` | text | Yes | 'member' or 'admin' |
| `_invited_by` | uuid | Yes | ID of user sending invite |
| `_dashboard_ids` | uuid[] | No | Array of dashboard UUIDs to assign |

**⚠️ CRITICAL: Parameter name is `_org_id`, not `_org`**

---

## Testing Checklist

- [ ] Build succeeds (`npm run build`)
- [ ] Function appears in Supabase API Docs
- [ ] Test function directly in SQL Editor
- [ ] Can create invitation via Members.tsx UI
- [ ] Invitation email is sent (check EmailJS)
- [ ] Invitation token is in email link
- [ ] Notifications page shows pending invitations
- [ ] Can accept invitation via Notifications page
- [ ] Newly accepted workspace appears in sidebar
- [ ] User can access assigned dashboards
- [ ] Duplicate invitations are rejected with error message

---

## Debugging Tips

### If function still not found:

1. **Check spelling:**
   ```sql
   SELECT * FROM pg_proc WHERE proname = 'create_invitation';
   ```

2. **Check schema:**
   ```sql
   SELECT * FROM pg_namespace WHERE nspname = 'public';
   ```

3. **Restart PostgREST** (if available in your plan):
   - Supabase Dashboard → Project Settings → Infrastructure
   - Click "Restart Server" on PostgREST

4. **Clear browser cache:**
   - Clear LocalStorage: `localStorage.clear()`
   - Refresh page in incognito mode

5. **Check RLS policies:**
   ```sql
   SELECT * FROM pg_policies 
   WHERE tablename = 'invitations' 
   AND policyname LIKE '%insert%';
   ```

### If RPC call fails with permission error:

1. Verify inviting user has `owner` or `admin` role in org_members
2. Check that org_id is valid and exists
3. Verify `_invited_by` user ID matches authenticated user
4. Check RLS policy allows the operation

### If invitation token is null:

1. Check that gen_random_uuid() is working
2. Verify database server time is synchronized
3. Check PostgreSQL version (gen_random_uuid requires 13+)

---

## Production Deployment Steps

1. **Backup Supabase database** (if production)
2. **Run entire schema.sql** in SQL Editor
3. **Wait for schema cache refresh** (5-10 seconds)
4. **Verify in API Docs** that `create_invitation` appears
5. **Deploy frontend** with updated Members.tsx
6. **Test invitation workflow** end-to-end
7. **Monitor logs** for any errors
8. **Enable email notifications** (EmailJS/SendGrid)
9. **Update documentation** with invitation process

---

## Files Modified

1. **`supabase/schema.sql`**
   - Fixed `create_invitation` function parameter order
   - Enhanced `accept_invitation` function
   - Added input validation
   - Added schema cache reload signal

2. **`src/pages/app/Members.tsx`**
   - Updated RPC call to use correct parameter names
   - Changed `_org` to `_org_id`

3. **`INVITATION_SYSTEM_DIAGNOSTICS.md`** (new)
   - Comprehensive troubleshooting guide
   - SQL diagnostic queries
   - Production checklist
