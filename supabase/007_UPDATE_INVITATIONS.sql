-- ============================================================
-- 007_UPDATE_INVITATIONS.sql
-- Migration: Update invitation table, RLS policies, and helper functions
-- ============================================================

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('member','admin')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  dashboard_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','accepted')),
  token text unique not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.invitations enable row level security;

-- ------------------------------------------------------------
-- Permissions for invitations table
-- ------------------------------------------------------------

drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    invited_by = auth.uid()
    or public.is_org_member(org_id, auth.uid())
  );

drop policy if exists "invitations_insert" on public.invitations;
create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "invitations_update" on public.invitations;
create policy "invitations_update" on public.invitations
  for update to authenticated
  using (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  )
  with check (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "invitations_delete" on public.invitations;
create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    invited_by = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- ------------------------------------------------------------
-- Invitation helper functions
-- ------------------------------------------------------------

drop function if exists public.create_invitation(text, uuid, text, uuid, uuid[]);
create or replace function public.create_invitation(
  _email text,
  _org_id uuid,
  _role text,
  _invited_by uuid,
  _dashboard_ids uuid[] default '{}'
)
returns public.invitations
language plpgsql security definer set search_path = public as $$
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
    raise exception 'Only workspace owners or admins can create invitations.';
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

drop function if exists public.accept_invitation(text);
create or replace function public.accept_invitation(p_token text)
returns table(org_id uuid, user_id uuid, role public.app_role)
language plpgsql security definer set search_path = public as $$
declare
  invite record;
  accepted_role public.app_role := 'member';
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invitation token is required';
  end if;

  select * into invite
  from public.invitations i
  where i.token = p_token
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

notify pgrst, 'reload schema';
