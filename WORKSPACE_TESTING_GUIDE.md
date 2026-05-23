# 🚀 Quick Start Guide: Fixed Workspace System

**Target**: Developers testing the fixed workspace creation flow  
**Time to implement**: 5 minutes  
**Status**: Ready to test

---

## What's Fixed?

✅ Workspace creation no longer fails with "infinite recursion" error
✅ Owner automatically added to org_members on workspace creation
✅ Member invitations work properly
✅ Team management fully functional
✅ RLS security remains intact

---

## How to Test

### Test 1: Create a New Workspace

```typescript
// In your React component or browser console:

// 1. Sign in (if not already logged in)

// 2. Navigate to: /app/dashboards/new (or wherever workspace creation is)

// 3. Create workspace:
//    - Name: "Test Workspace"
//    - Click Create

// Expected result:
//    ✅ Workspace created
//    ✅ Redirect to workspace
//    ✅ No error messages
```

### Test 2: Verify Creator is Owner

```sql
-- Run in Supabase SQL Editor

-- Replace 'your-user-id' with actual user UUID
SELECT org_id, user_id, role 
FROM public.org_members 
WHERE user_id = 'your-user-id';

-- Expected result:
-- | org_id | user_id | role |
-- |--------|---------|------|
-- | xyz... | abc...  | owner|

-- Should show role = 'owner'
```

### Test 3: Invite a Team Member

```typescript
// In the app:

// 1. Go to workspace
// 2. Click "Members" or "Team"
// 3. Click "Invite Member"
// 4. Enter test email: test-member@example.com
// 5. Select role: "Editor"
// 6. Click "Send Invite"

// Expected result:
//    ✅ Invitation sent
//    ✅ No database errors
//    ✅ Member appears in pending list
```

### Test 4: Accept Invitation

```typescript
// In a different browser/session:

// 1. Open invite link from email (or manually craft URL)
// 2. Accept invitation
// 3. Sign in with invited email

// Expected result:
//    ✅ Accepted invitation
//    ✅ Added to org_members with correct role
//    ✅ Can access workspace
```

### Test 5: Verify Role-Based Permissions

```typescript
// As Editor (not Admin/Owner):

// Should be able to:
// ✅ View workspace
// ✅ Create/edit dashboards
// ✅ View members list

// Should NOT be able to:
// ❌ Invite new members
// ❌ Remove members
// ❌ Change member roles
// ❌ Delete workspace
```

---

## Database Verification Queries

### Check All Workspaces and Owners

```sql
SELECT 
  o.id as org_id,
  o.name,
  o.created_by,
  om.user_id as owner_user_id,
  om.role
FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id AND om.role = 'owner'
ORDER BY o.created_at DESC;
```

### Check Specific User's Memberships

```sql
SELECT 
  om.org_id,
  o.name as org_name,
  om.role,
  om.created_at
FROM public.org_members om
JOIN public.orgs o ON om.org_id = o.id
WHERE om.user_id = auth.uid()
ORDER BY om.created_at DESC;

-- Run this in SQL Editor (no parameters needed, uses auth.uid())
```

### Check Pending Invitations

```sql
SELECT 
  i.id,
  i.email,
  o.name as org_name,
  i.role,
  i.status,
  i.expires_at
FROM public.invitations i
JOIN public.orgs o ON i.org_id = o.id
WHERE i.status = 'pending'
ORDER BY i.created_at DESC;
```

### Check Helper Functions Work

```sql
-- Test is_org_member
SELECT public.is_org_member(
  'org-uuid-here'::uuid,
  'user-uuid-here'::uuid
);

-- Should return: true or false

-- Test has_org_role
SELECT public.has_org_role(
  'org-uuid-here'::uuid,
  'user-uuid-here'::uuid,
  array['owner', 'admin']::public.app_role[]
);

-- Should return: true (if user is owner or admin) or false
```

---

## Step-by-Step: Create Workspace → Add Members → Test Permissions

### Step 1: Create Workspace (5 min)

```
1. Log in to app
2. Navigate to new workspace
3. Enter name: "QA Testing Workspace"
4. Click Create
5. Verify workspace appears in list
```

**Expected Supabase State**:
```
orgs table: +1 new row (created_by = current user)
org_members table: +1 new row (user = current user, role = owner)
```

### Step 2: Invite Team Member (5 min)

```
1. Click "Members" tab
2. Click "Invite New Member"
3. Email: qa.member@company.com
4. Role: Editor
5. Click Send
```

**Expected Supabase State**:
```
invitations table: +1 new row (status = pending, expires_at = 7 days)
```

### Step 3: Accept Invitation (5 min)

```
1. Check email for invite link
2. Open link in NEW browser/incognito
3. Click "Accept Invitation"
4. Sign up with qa.member@company.com
5. Verify redirected to workspace
```

**Expected Supabase State**:
```
org_members table: +1 new row (user = qa.member@company.com, role = editor)
auth.users table: +1 new user
invitations table: updated row (status = accepted)
```

### Step 4: Test Permission (5 min)

```
As QA Member (Editor role):
✅ Can view dashboards
✅ Can create new dashboard
✅ Can edit dashboard (drag widgets)
✅ Can save dashboard

❌ Cannot invite members (should see disabled button)
❌ Cannot change member roles
❌ Cannot delete workspace
```

**Expected Error** (if trying to do unauthorized action):
```
Policy violation: "User does not have permission to perform this action"
```

---

## Troubleshooting During Testing

### Issue: "Infinite Recursion" Error

**Solution**:
1. Refresh Supabase connection:
   - Project Settings → Database → Reset Connection Pool
2. Wait 30 seconds
3. Try again

### Issue: Can't Find Created Workspace

**Check**:
```sql
SELECT * FROM public.orgs ORDER BY created_at DESC LIMIT 10;
```

If workspace appears but user doesn't see it:
```sql
SELECT * FROM public.org_members 
WHERE org_id = 'workspace-uuid' AND role = 'owner';

-- Should show creator as owner
```

### Issue: Invitation Not Sending

**Check**:
1. Email service configured (EmailJS)
2. Invitation created in DB:
   ```sql
   SELECT * FROM public.invitations WHERE email = 'test@example.com';
   ```
3. Browser console for client-side errors

### Issue: Accepting Invitation Fails

**Check**:
1. Invitation still pending: `status = 'pending'`
2. Email matches: `lower(invitations.email) = lower(auth.jwt() ->> 'email')`
3. Not expired: `expires_at > now()`

---

## Performance Checklist

After fix, verify performance:

| Operation | Expected Time | Actual Time | Status |
|-----------|---------------|-------------|--------|
| Create workspace | <100ms | ? | ✅/❌ |
| Add member | <200ms | ? | ✅/❌ |
| Load members | <50ms | ? | ✅/❌ |
| Permission check | <10ms | ? | ✅/❌ |
| Accept invitation | <150ms | ? | ✅/❌ |

**How to measure**:
```typescript
// In browser console:
console.time('Create workspace');
await createWorkspace({ name: 'Test' });
console.timeEnd('Create workspace');
```

---

## Sign-Off Checklist

- [ ] Applied migration (012_FIX_ORG_MEMBERS_RECURSION.sql)
- [ ] Connection pool reset in Supabase
- [ ] Created test workspace (no errors)
- [ ] Creator is owner in org_members
- [ ] Invited team member (no errors)
- [ ] Member accepted invitation
- [ ] Member has correct role in org_members
- [ ] Permissions working (can't access unauthorized actions)
- [ ] All database verification queries pass
- [ ] Performance acceptable
- [ ] No "infinite recursion" errors in logs
- [ ] No "PGRST301" or RLS errors
- [ ] Ready for production deployment

---

## Next Steps

1. **Develop against fixed schema**
   - Use workspace/org features normally
   - Submit any bugs found

2. **Run integration tests**
   - Test all member operations
   - Test role-based access control
   - Test invitation flow

3. **Deploy to production**
   - Apply migration to prod database
   - Verify existing workspaces work
   - Monitor for errors

4. **Document in changelogs**
   - Note: "Fixed infinite recursion in org_members RLS"
   - Link to ORG_MEMBERS_RECURSION_FIX.md

---

## Quick Reference: SQL Diagnostics

```bash
# Copy and run these to diagnose issues:

# 1. Check policies exist
SELECT policyname FROM pg_policies WHERE tablename = 'org_members';

# 2. Check functions exist
SELECT proname FROM pg_proc WHERE proname LIKE '%org%';

# 3. Check trigger exists
SELECT tgname FROM pg_trigger WHERE tgname = 'on_org_created';

# 4. Check data relationships
SELECT COUNT(*) as missing_owners FROM public.orgs o
LEFT JOIN public.org_members om ON o.id = om.org_id AND om.role = 'owner'
WHERE om.org_id IS NULL AND o.created_by IS NOT NULL;

# Expected: 0 (all orgs should have owners)
```

---

**Status**: Ready for Testing
**Risk Level**: Low
**Rollback**: Previous migration available
**Support**: See ORG_MEMBERS_RECURSION_FIX.md for detailed troubleshooting

