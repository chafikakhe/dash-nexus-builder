-- ============================================================
-- 006_FIX_INVITATIONS_RLS.sql
-- Migration: Fix invitation RLS policies and create_invitation/accept_invitation helpers
-- ============================================================

-- Invitation select policy: allow org admins, invited user by email, or inviter
DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
CREATE POLICY "invitations_select" ON public.invitations
  FOR SELECT TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    OR lower(email) = lower(auth.jwt() ->> 'email')
    OR invited_by = auth.uid()
  );

-- Invitation insert policy: only org owners/admins can create invitations
DROP POLICY IF EXISTS "invitations_insert" ON public.invitations;
CREATE POLICY "invitations_insert" ON public.invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- Invitation update policy: allow invited user or org admin
DROP POLICY IF EXISTS "invitations_update" ON public.invitations;
CREATE POLICY "invitations_update" ON public.invitations
  FOR UPDATE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    OR lower(email) = lower(auth.jwt() ->> 'email')
  )
  WITH CHECK (
    (status != 'accepted')
    OR lower(email) = lower(auth.jwt() ->> 'email')
  );

-- Invitation delete policy: allow org admins or inviter
DROP POLICY IF EXISTS "invitations_delete" ON public.invitations;
CREATE POLICY "invitations_delete" ON public.invitations
  FOR DELETE TO authenticated
  USING (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    OR invited_by = auth.uid()
  );

-- Create or replace invitation helper functions
DROP FUNCTION IF EXISTS public.create_invitation(text, uuid, text, uuid, uuid[]);
CREATE OR REPLACE FUNCTION public.create_invitation(
  _email text,
  _org_id uuid,
  _role text,
  _invited_by uuid,
  _dashboard_ids uuid[] DEFAULT '{}'
)
RETURNS public.invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  invite_row public.invitations;
  invite_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'Authentication required to create invitation.';
  end if;

  if _email is null or btrim(_email) = '' then
    raise exception 'Email is required';
  end if;
  if _org_id is null then
    raise exception 'Organization ID is required';
  end if;
  if _invited_by is null then
    raise exception 'Invited by user ID is required';
  end if;
  if _invited_by <> auth.uid() then
    raise exception 'Invited by must be the authenticated user.';
  end if;

  if not exists (
    select 1 from public.org_members
    where org_id = _org_id
      and user_id = auth.uid()
      and role = any(array['owner','admin']::public.app_role[])
  ) then
    raise exception 'Only workspace owners or admins can invite users.';
  end if;

  select exists(
    select 1 from public.invitations
    where org_id = _org_id
      and lower(email) = lower(trim(_email))
      and status = 'pending'
  ) into invite_exists;

  if invite_exists then
    raise exception 'An invitation is already pending for %', _email;
  end if;

  insert into public.invitations (email, org_id, role, invited_by, dashboard_ids, status)
  values (lower(trim(_email)), _org_id, _role, _invited_by, coalesce(_dashboard_ids, '{}'), 'pending')
  returning * into invite_row;

  return invite_row;
end;
$$;
alter function public.create_invitation(text, uuid, text, uuid, uuid[]) set row_security = off;

DROP FUNCTION IF EXISTS public.accept_invitation(text);
CREATE OR REPLACE FUNCTION public.accept_invitation(token text)
RETURNS TABLE(org_id uuid, user_id uuid, role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
declare
  invite record;
  accepted_role public.app_role := 'member';
begin
  if token is null or btrim(token) = '' then
    raise exception 'Invitation token is required';
  end if;

  select * into invite
  from public.invitations i
  where i.token = token
  limit 1;

  if invite.id is null then
    raise exception 'Invitation not found.';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invitation already accepted.';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to accept invitation.';
  end if;

  if lower(invite.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Please sign in with the invited email to accept this invitation.';
  end if;

  if invite.role = 'admin' then
    accepted_role := 'admin';
  end if;

  insert into public.org_members (org_id, user_id, role)
  values (invite.org_id, auth.uid(), accepted_role)
  on conflict (org_id, user_id) do update
    set role = case
      when org_members.role = 'owner' then 'owner'
      when excluded.role = 'admin' then 'admin'
      else org_members.role
    end;

  if array_length(invite.dashboard_ids, 1) is not null and array_length(invite.dashboard_ids, 1) > 0 then
    insert into public.dashboard_permissions (dashboard_id, user_id, org_id)
    select d.id, auth.uid(), invite.org_id
    from public.dashboards d
    where d.id = any(invite.dashboard_ids)
      and d.org_id = invite.org_id
    on conflict (dashboard_id, user_id) do nothing;
  end if;

  delete from public.invitations
  where id = invite.id;

  return query select invite.org_id, auth.uid(), accepted_role;
end;
$$;
alter function public.accept_invitation(text) set row_security = off;

-- Refresh PostgREST cache if needed
NOTIFY pgrst, 'reload schema';
