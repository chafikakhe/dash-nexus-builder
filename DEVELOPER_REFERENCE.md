# 🔑 Developer Reference: Using the Fixed Workspace System

**For**: Frontend & Backend Developers  
**Time to Read**: 10 minutes  
**Updated**: May 23, 2026

---

## Quick Reference

### Check If User Is Owner

```typescript
// In your frontend code:
import { useAuth } from "@/contexts/AuthContext";

function WorkspaceSettings() {
  const { user, orgs, currentOrgId } = useAuth();
  
  const currentOrg = orgs.find(o => o.id === currentOrgId);
  const isOwner = currentOrg?.role === 'owner';
  
  return (
    <div>
      {isOwner && (
        <button>Delete Workspace</button>  {/* Only owners see this */}
      )}
    </div>
  );
}
```

### Check Multiple Roles

```typescript
const isAdminOrOwner = ['owner', 'admin'].includes(currentOrg?.role);
const canEditDashboards = ['owner', 'admin', 'editor'].includes(currentOrg?.role);
const canViewOnly = currentOrg?.role === 'viewer';
```

### Check Permission via Supabase Function

```typescript
// If you need to verify from Supabase directly:
const { data, error } = await supabase.rpc('has_org_role', {
  p_org_id: orgId,
  p_user_id: userId,
  p_roles: ['owner', 'admin']
});

if (data === true) {
  // User is owner or admin
}
```

---

## Common Operations

### Create Workspace

**How it works now (after fix)**:

```typescript
// Frontend:
const createWorkspace = async (name: string) => {
  const { data, error } = await supabase.from('orgs').insert({
    name,
    slug: generateSlug(name),
    created_by: user.id,  // Current user
    owner_id: user.id,    // Will be set by trigger
  }).select().single();

  if (error) throw error;
  
  // ✅ User automatically added as owner
  // ✅ No "infinite recursion" error
  // ✅ Workspace ready to use
  
  return data;
};
```

**What happens in database**:

```
1. INSERT into orgs (created_by = current_user)
2. Trigger fires: on_org_created
3. Trigger automatically: INSERT into org_members (user_id = created_by, role = owner)
4. ✅ Complete - user is owner, no RLS issues
```

**Backend verification**:

```typescript
// After creating workspace, verify:
const { data: membership } = await supabase
  .from('org_members')
  .select('*')
  .eq('org_id', workspaceId)
  .eq('user_id', userId)
  .eq('role', 'owner')
  .single();

console.assert(membership, 'User should be owner');
```

### Add Team Member

```typescript
// Frontend - Invite a member:
const inviteMember = async (
  organizationId: string,
  email: string,
  role: 'admin' | 'editor' | 'viewer'
) => {
  const { data, error } = await supabase.rpc('create_invitation', {
    _email: email,
    _org_id: organizationId,
    _role: role,
    _invited_by: user.id,
    _dashboard_ids: []
  });

  if (error) {
    // Error handling:
    // - "Only workspace owners or admins can create invitations"
    // - "An invitation is already pending for {email}"
    console.error(error.message);
    return null;
  }

  return data;  // Returns invitation with token & expires_at
};
```

### Accept Invitation

```typescript
// Frontend - User accepts invitation:
const acceptInvitation = async (invitationToken: string) => {
  const { data, error } = await supabase.rpc('accept_invitation', {
    p_token: invitationToken
  });

  if (error) {
    // Error handling:
    // - "Invitation not found"
    // - "Invitation already accepted"
    // - "Authentication required"
    console.error(error.message);
    return null;
  }

  // data: { org_id, user_id, role }
  // User is now member of organization
  return data;
};
```

### List Org Members

```typescript
// Frontend:
const getOrgMembers = async (organizationId: string) => {
  const { data, error } = await supabase.rpc('get_org_members', {
    p_org_id: organizationId
  });

  if (error) throw error;
  
  // data: Array of { user_id, email, role, created_at }
  return data;
};
```

---

## Permission Checks

### Frontend: Show/Hide UI Based on Role

```typescript
function MembersPage() {
  const { user, orgs, currentOrgId } = useAuth();
  const currentOrg = orgs.find(o => o.id === currentOrgId);
  
  // Determine what to show
  const isOwner = currentOrg?.role === 'owner';
  const isAdmin = ['owner', 'admin'].includes(currentOrg?.role);
  
  return (
    <div>
      <h1>Team Members</h1>
      
      {/* Everyone can see the list */}
      <MembersList orgId={currentOrgId} />
      
      {/* Only owner/admin can invite */}
      {isAdmin && (
        <button onClick={openInviteDialog}>
          Invite Member
        </button>
      )}
      
      {/* Only owner can change roles */}
      {isOwner && (
        <MemberRoleSelector />
      )}
    </div>
  );
}
```

### Backend: Enforce Permissions

```typescript
// API endpoint to change member role:
async function changeMemberRole(
  orgId: string,
  userId: string,
  newRole: string
) {
  // Check: Is current user an owner?
  const hasPermission = await supabase.rpc('has_org_role', {
    p_org_id: orgId,
    p_user_id: auth.uid(),
    p_roles: ['owner']
  });
  
  if (!hasPermission) {
    throw new Error('Only owners can change member roles');
  }
  
  // Safe to update
  return supabase
    .from('org_members')
    .update({ role: newRole })
    .eq('org_id', orgId)
    .eq('user_id', userId);
}
```

---

## Handling Errors

### RLS Violation Errors

**Error**: `Error: new row violates row-level security policy "org_members_insert"`

**Causes**:
- User trying to add member but not admin/owner
- Invalid org_id
- User not in org_members for this org

**Fix**:
```typescript
// Always check permission first
if (!isAdmin) {
  throw new Error('Must be admin to add members');
}

// Then perform operation
await addMember(...);
```

### "Infinite Recursion" Error (Should not happen after fix)

**Error**: `Error: infinite recursion detected in policy for relation "org_members"`

**Solutions**:
1. Reset connection pool in Supabase dashboard
2. Verify migration was applied correctly
3. Check if old policies still exist (drop them)

### Invitation Expired

**Error**: `Error: Invitation not found` or `Invitation already expired`

**Check**:
```typescript
// Verify invitation is still valid:
const { data: invitation } = await supabase
  .from('invitations')
  .select('*')
  .eq('token', inviteToken)
  .single();

if (!invitation) {
  console.error('Invitation not found');
  return;
}

if (new Date(invitation.expires_at) < new Date()) {
  console.error('Invitation expired');
  return;
}

if (invitation.status !== 'pending') {
  console.error('Invitation already used');
  return;
}
```

---

## Testing Your Code

### Unit Test Example

```typescript
// Test workspace creation
describe('Workspace Creation', () => {
  it('should create workspace and make creator owner', async () => {
    const userId = 'test-user-id';
    
    // Create workspace
    const workspace = await createWorkspace({
      name: 'Test Org',
      created_by: userId
    });
    
    // Verify trigger created org_member entry
    const { data: membership } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', workspace.id)
      .eq('user_id', userId)
      .eq('role', 'owner')
      .single();
    
    expect(membership).toBeDefined();
    expect(membership.role).toBe('owner');
  });
  
  it('should not allow non-admin to add members', async () => {
    const workspace = await createWorkspace({ name: 'Test' });
    
    // Try to invite as viewer (should fail)
    const result = await inviteMember(
      workspace.id,
      'new@example.com',
      'editor',
      { role: 'viewer' }  // Current user is viewer
    );
    
    expect(result).toThrow('Only admins can invite');
  });
});
```

### Integration Test Example

```typescript
// Full flow: Create workspace → Invite → Accept
describe('Member Invitation Flow', () => {
  it('should complete full invitation flow', async () => {
    // Step 1: Owner creates workspace
    const workspace = await createWorkspace({
      name: 'Integration Test',
      created_by: ownerUserId
    });
    
    // Step 2: Owner invites member
    const invitation = await inviteMember(
      workspace.id,
      'member@example.com',
      'editor'
    );
    
    expect(invitation.status).toBe('pending');
    
    // Step 3: Member accepts invitation
    const membership = await acceptInvitation(invitation.token);
    
    expect(membership.role).toBe('editor');
    expect(membership.org_id).toBe(workspace.id);
    
    // Step 4: Verify member is in org_members
    const { data: members } = await supabase
      .from('org_members')
      .select('*')
      .eq('org_id', workspace.id);
    
    expect(members).toHaveLength(2);  // Owner + Member
  });
});
```

---

## Database Schema Reference

### org_members Table

```typescript
interface OrgMember {
  org_id: string;              // UUID of organization
  user_id: string;             // UUID of user
  role: 'owner' | 'admin' | 'editor' | 'viewer' | 'member';
  created_at: Date;
  updated_at: Date;
}
```

### invitations Table

```typescript
interface Invitation {
  id: string;                  // UUID
  email: string;               // Invited email
  org_id: string;              // Organization UUID
  role: string;                // Role to assign
  invited_by: string;          // User UUID who sent invite
  status: 'pending' | 'accepted' | 'rejected';
  token: string;               // Unique token for accepting
  expires_at: Date;            // 7 days from creation
  accepted_at?: Date;
  created_at: Date;
}
```

---

## Helper Functions Available

### is_org_member(org_id, user_id) → boolean

```sql
-- Check if user is member of org (any role)
SELECT public.is_org_member('org-uuid'::uuid, 'user-uuid'::uuid);

-- Returns: true | false
```

### has_org_role(org_id, user_id, roles[]) → boolean

```sql
-- Check if user has specific role
SELECT public.has_org_role(
  'org-uuid'::uuid, 
  'user-uuid'::uuid, 
  array['owner', 'admin']::public.app_role[]
);

-- Returns: true | false
```

### is_org_creator(org_id, user_id) → boolean

```sql
-- Check if user created the org
SELECT public.is_org_creator('org-uuid'::uuid, 'user-uuid'::uuid);

-- Returns: true | false
```

### get_org_member_count(org_id) → bigint

```sql
-- Count members in org
SELECT public.get_org_member_count('org-uuid'::uuid);

-- Returns: count (0+)
```

---

## Best Practices

✅ **DO**:
- Always check role in UI before showing controls
- Verify permission on backend before modifying data
- Handle invitation expiration (7 days)
- Use helper functions for permission checks
- Log permission violations for security

❌ **DON'T**:
- Trust client-side permission checks alone
- Assume user has permission without verifying
- Keep invitation tokens in URLs without verification
- Modify org_members directly (use RPC functions)
- Store sensitive data in localStorage without encryption

---

## Debugging Permission Issues

### Query to verify user's access

```sql
-- See all data current user can access:
SELECT org_id, name, role FROM org_members
WHERE user_id = auth.uid();

-- Check what this user can do:
SELECT 
  public.has_org_role(om.org_id, auth.uid(), array['owner']::public.app_role[]) as is_owner,
  public.has_org_role(om.org_id, auth.uid(), array['admin']::public.app_role[]) as is_admin,
  public.is_org_member(om.org_id, auth.uid()) as is_member
FROM org_members om
WHERE om.user_id = auth.uid();
```

### Check if RLS is blocking query

```typescript
// If getting PGRST301 error:
const { data, error } = await supabase
  .from('org_members')
  .select('*');

console.log('Error:', error);
// If error.code === 'PGRST301':
//   → User doesn't have permission
//   → Check if they're in org_members
//   → Verify role hasn't been downgraded
```

---

## Migration Checklist for Teams

Before going live with fixed system:

- [ ] All developers have applied migration (012_FIX_ORG_MEMBERS_RECURSION.sql)
- [ ] Testing against new database schema complete
- [ ] Workspace creation tests passing
- [ ] Member invitation tests passing
- [ ] Permission checks working correctly
- [ ] No "infinite recursion" errors observed
- [ ] Performance acceptable (<100ms per operation)
- [ ] Error handling updated for new functions
- [ ] Documentation updated with new RPC names
- [ ] Ready for production deployment

---

**Reference Generated**: May 23, 2026  
**Applies To**: After applying 012_FIX_ORG_MEMBERS_RECURSION.sql  
**Status**: Production Ready

