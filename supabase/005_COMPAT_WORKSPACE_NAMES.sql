-- ============================================================
-- Compatibility migration for old workspace_* table names
-- Adds views so legacy Supabase requests to workspace_members/
-- and workspace_invitations/ continue to work.
-- ============================================================

create or replace view public.workspace_members as
select
  org_id,
  user_id,
  role,
  created_at
from public.org_members;

grant select on public.workspace_members to authenticated;

grant select on public.workspace_members to anon;

create or replace view public.workspace_invitations as
select
  id,
  email,
  org_id,
  role,
  invited_by,
  status,
  token,
  created_at,
  accepted_at
from public.invitations;

grant select on public.workspace_invitations to authenticated;

grant select on public.workspace_invitations to anon;
