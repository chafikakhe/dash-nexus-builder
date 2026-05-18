-- ============================================================
-- DashForge — Invite Members system
-- Add invitations table, RLS policies, and acceptance helper.
-- Run this file in Supabase SQL editor to update the database.
-- ============================================================

create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role text not null check (role in ('member','admin')),
  invited_by uuid not null references auth.users(id) on delete cascade,
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
-- Invitation acceptance helper
-- ------------------------------------------------------------

create or replace function public.accept_invitation(_token text)
returns table(org_id uuid, user_id uuid, role public.app_role)
language plpgsql security definer set search_path = public as $$
declare
  invite record;
  accepted_role public.app_role := 'viewer';
begin
  select * into invite
  from public.invitations
  where token = _token
  limit 1;

  if invite.id is null then
    raise exception 'Invitation not found or already accepted.';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invitation already accepted.';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required to accept invitation.';
  end if;

  if not exists (
    select 1 from auth.users
    where id = auth.uid() and lower(email) = lower(invite.email)
  ) then
    raise exception 'Please sign in with % to accept this invitation.', invite.email;
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

  update public.invitations
  set status = 'accepted', accepted_at = now()
  where id = invite.id;

  return query select invite.org_id, auth.uid(), accepted_role;
end;
$$;
