-- ============================================================
-- 008_FIX_ACCEPT_INVITATION.sql
-- Migration: Update accept_invitation RPC function for Supabase
-- ============================================================

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
ALTER FUNCTION public.accept_invitation(text) SET row_security = off;

NOTIFY pgrst, 'reload schema';
