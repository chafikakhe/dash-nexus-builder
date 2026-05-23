-- 011_WORKSPACE_BOOTSTRAP_CLEAN_REBUILD.sql
-- Complete clean rebuild of workspace bootstrap architecture
-- Fixes: workspace creation, owner membership, active workspace detection, invitations
-- This migration rebuilds the entire workspace system for production stability

BEGIN;

-- STEP 1: ENSURE CORE TABLES EXIST -----------------------------------------------

-- Create app_role enum if it doesn't exist
do $$ begin
  create type public.app_role as enum ('owner','admin','member','editor','viewer');
exception when duplicate_object then null; end $$;

-- Add any missing values to app_role
alter type public.app_role add value if not exists 'member';
alter type public.app_role add value if not exists 'editor';
alter type public.app_role add value if not exists 'viewer';

-- Create orgs table if it doesn't exist
create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create org_members table if it doesn't exist
create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

-- Create user_preferences table for active workspace tracking
create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  active_org_id uuid references public.orgs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create invitations table if it doesn't exist
create table if not exists public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  role public.app_role not null default 'member',
  invited_by uuid not null references auth.users(id) on delete cascade,
  dashboard_ids uuid[] not null default '{}',
  status text not null default 'pending' check (status in ('pending','pending_accept','accepted','rejected')),
  token text unique not null default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create dashboard_permissions table if it doesn't exist
create table if not exists public.dashboard_permissions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dashboard_id, user_id)
);

-- Create notifications table if it doesn't exist
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  org_id uuid not null references public.orgs(id) on delete cascade,
  type text not null check (type in ('workspace_invite','invite_accepted','invite_rejected','system')),
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  is_resolved boolean not null default false,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

-- STEP 2: CLEAN UP OLD POLICIES AND TRIGGERS -----------------------------------------------

-- Drop policies that depend on helper functions first
drop policy if exists "orgs_member_select" on public.orgs;
drop policy if exists "collections_select" on public.collections;
drop policy if exists "records_select" on public.collection_records;

-- Drop all existing policies on these tables to start fresh
drop policy if exists "org_members_select" on public.org_members;
drop policy if exists "org_members_insert" on public.org_members;
drop policy if exists "org_members_update" on public.org_members;
drop policy if exists "org_members_delete" on public.org_members;

drop policy if exists "invitations_select" on public.invitations;
drop policy if exists "invitations_insert" on public.invitations;
drop policy if exists "invitations_update" on public.invitations;
drop policy if exists "invitations_delete" on public.invitations;

drop policy if exists "dashboard_permissions_select" on public.dashboard_permissions;
drop policy if exists "dashboard_permissions_insert" on public.dashboard_permissions;
drop policy if exists "dashboard_permissions_delete" on public.dashboard_permissions;

drop policy if exists "notifications_select" on public.notifications;
drop policy if exists "notifications_insert" on public.notifications;
drop policy if exists "notifications_update" on public.notifications;
drop policy if exists "notifications_delete" on public.notifications;

drop policy if exists "user_preferences_select" on public.user_preferences;
drop policy if exists "user_preferences_insert" on public.user_preferences;
drop policy if exists "user_preferences_update" on public.user_preferences;

-- Drop old triggers and functions
drop trigger if exists on_auth_user_created on auth.users;
drop trigger if exists auth_user_created on auth.users;
drop trigger if exists notifications_on_user_insert on auth.users;
drop function if exists public.handle_new_user() cascade;

-- Drop old RPC functions
drop function if exists public.create_invitation(text, uuid, public.app_role, uuid[]);
drop function if exists public.accept_invitation(text);
drop function if exists public.reject_invitation(text);
drop function if exists public.create_notification(text, uuid, text, uuid, jsonb);

-- Drop old helper functions with original parameter names (after policies are dropped)
drop function if exists public.is_org_member(uuid, uuid) cascade;
drop function if exists public.has_org_role(uuid, uuid, public.app_role[]) cascade;
drop function if exists public.get_user_org_count(uuid) cascade;

-- STEP 3: CREATE INDEXES -----------------------------------------------

-- org_members indexes
drop index if exists org_members_org_user_uindex;
drop index if exists org_members_user_idx;
create unique index org_members_org_user_uindex on public.org_members (org_id, user_id);
create index org_members_user_idx on public.org_members (user_id);

-- invitations indexes
drop index if exists invitations_token_idx;
drop index if exists invitations_org_idx;
drop index if exists invitations_email_idx;
drop index if exists invitations_expires_idx;
create unique index invitations_token_idx on public.invitations (token);
create index invitations_org_idx on public.invitations (org_id);
create index invitations_email_idx on public.invitations (lower(email));
create index invitations_expires_idx on public.invitations (expires_at);

-- dashboard_permissions indexes
drop index if exists dashboard_permissions_dashboard_user_uindex;
drop index if exists dashboard_permissions_org_idx;
create unique index dashboard_permissions_dashboard_user_uindex on public.dashboard_permissions (dashboard_id, user_id);
create index dashboard_permissions_org_idx on public.dashboard_permissions (org_id);

-- notifications indexes
drop index if exists notifications_recipient_id_idx;
drop index if exists notifications_recipient_email_idx;
drop index if exists notifications_org_idx;
create index notifications_recipient_id_idx on public.notifications (recipient_id);
create index notifications_recipient_email_idx on public.notifications (lower(recipient_email));
create index notifications_org_idx on public.notifications (org_id);

-- user_preferences indexes
drop index if exists user_preferences_active_org_idx;
create index user_preferences_active_org_idx on public.user_preferences (active_org_id);

-- STEP 4: ENABLE RLS ON ALL TABLES -----------------------------------------------

alter table public.orgs enable row level security;
alter table public.org_members enable row level security;
alter table public.user_preferences enable row level security;
alter table public.invitations enable row level security;
alter table public.dashboard_permissions enable row level security;
alter table public.notifications enable row level security;

-- STEP 5: CREATE RLS POLICIES -----------------------------------------------

-- ORGS POLICIES
create policy "orgs_select" on public.orgs
  for select to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.orgs.id
        and om.user_id = auth.uid()
    )
  );

-- ORG_MEMBERS POLICIES
create policy "org_members_select" on public.org_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.org_members om
      where om.org_id = public.org_members.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

create policy "org_members_insert" on public.org_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.org_members.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

create policy "org_members_update" on public.org_members
  for update to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.org_members.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  )
  with check (
    org_id = public.org_members.org_id
  );

create policy "org_members_delete" on public.org_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.org_members.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

-- USER_PREFERENCES POLICIES
create policy "user_preferences_select" on public.user_preferences
  for select to authenticated
  using (user_id = auth.uid());

create policy "user_preferences_insert" on public.user_preferences
  for insert to authenticated
  with check (user_id = auth.uid());

create policy "user_preferences_update" on public.user_preferences
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- INVITATIONS POLICIES
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    -- Org admin/owner can see all invitations for their org
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    -- Invitee can see their own invitation
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
    -- Inviter can see invitations they created
    or public.invitations.invited_by = auth.uid()
  );

create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (
    -- Only org owner/admin can create invitations
    public.invitations.invited_by = auth.uid()
    and exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

create policy "invitations_update" on public.invitations
  for update to authenticated
  using (
    -- Org admin/owner can update
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    -- Invitee can update their own invitation
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
  )
  with check (
    -- Only allow status changes on pending invitations
    public.invitations.status in ('pending','rejected')
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
  );

create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    -- Only org owner/admin can delete
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    or public.invitations.invited_by = auth.uid()
  );

-- DASHBOARD_PERMISSIONS POLICIES
create policy "dashboard_permissions_select" on public.dashboard_permissions
  for select to authenticated
  using (
    public.dashboard_permissions.user_id = auth.uid()
    or exists (
      select 1 from public.org_members om
      where om.org_id = public.dashboard_permissions.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

create policy "dashboard_permissions_insert" on public.dashboard_permissions
  for insert to authenticated
  with check (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.dashboard_permissions.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

create policy "dashboard_permissions_delete" on public.dashboard_permissions
  for delete to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.dashboard_permissions.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
  );

-- NOTIFICATIONS POLICIES
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    public.notifications.recipient_id = auth.uid()
    or lower(public.notifications.recipient_email) = lower(auth.jwt() ->> 'email')
  );

create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (
    public.notifications.recipient_id = auth.uid()
    or lower(public.notifications.recipient_email) = lower(auth.jwt() ->> 'email')
  );

create policy "notifications_update" on public.notifications
  for update to authenticated
  using (public.notifications.recipient_id = auth.uid())
  with check (public.notifications.recipient_id = auth.uid());

create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using (public.notifications.recipient_id = auth.uid());

-- STEP 6: CREATE CORE HELPER FUNCTIONS -----------------------------------------------

create or replace function public.is_org_member(p_org uuid, p_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = p_org and user_id = p_user
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_user uuid, p_roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members om
    where om.org_id = p_org
      and om.user_id = p_user
      and om.role = any(p_roles)
  );
$$;

create or replace function public.get_user_org_count(p_user uuid)
returns bigint language sql stable security definer set search_path = public as $$
  select count(*)
  from public.org_members
  where user_id = p_user;
$$;

-- STEP 7: CREATE CORE RPC FUNCTIONS -----------------------------------------------

-- CREATE WORKSPACE RPC
-- This is the PRIMARY way to create workspaces
create or replace function public.create_workspace(p_name text)
returns table(
  org_id uuid,
  org_name text,
  org_slug text,
  role public.app_role
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_org_id uuid;
  v_slug text;
  v_base_slug text;
  v_counter int := 1;
  v_existing_count int;
begin
  if v_user is null then
    raise exception 'Authentication required to create workspace.';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'Workspace name is required.';
  end if;

  -- Generate slug from name
  v_base_slug := lower(btrim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-|-$)', '', 'g');
  v_base_slug := substring(v_base_slug, 1, 30);

  v_slug := v_base_slug;

  -- Ensure slug uniqueness
  loop
    select count(*) into v_existing_count
    from public.orgs
    where slug = v_slug;
    
    exit when v_existing_count = 0;
    
    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  end loop;

  -- Insert org within transaction
  insert into public.orgs (name, slug, owner_id, created_by, plan)
  values (btrim(p_name), v_slug, v_user, v_user, 'free')
  returning id into v_org_id;

  -- Immediately insert creator as owner in org_members
  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, v_user, 'owner'::public.app_role);

  -- Set as active workspace in user_preferences
  insert into public.user_preferences (user_id, active_org_id)
  values (v_user, v_org_id)
  on conflict (user_id) do update
  set active_org_id = v_org_id, updated_at = now();

  return query
  select v_org_id, btrim(p_name), v_slug, 'owner'::public.app_role;
end;
$$;
alter function public.create_workspace(text) set row_security = off;

-- GET USER WORKSPACES RPC
-- Returns all workspaces the user has membership in
create or replace function public.get_user_workspaces()
returns table(
  org_id uuid,
  org_name text,
  org_slug text,
  role public.app_role,
  plan text
)
language sql stable security definer set search_path = public as $$
  select
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    om.role,
    o.plan
  from public.orgs o
  inner join public.org_members om on om.org_id = o.id
  where om.user_id = auth.uid()
  order by om.created_at desc;
$$;
alter function public.get_user_workspaces() set row_security = off;

-- GET ACTIVE WORKSPACE RPC
-- Returns the user's currently selected workspace
create or replace function public.get_active_workspace()
returns table(
  org_id uuid,
  org_name text,
  org_slug text,
  role public.app_role,
  plan text
)
language sql stable security definer set search_path = public as $$
  select
    o.id as org_id,
    o.name as org_name,
    o.slug as org_slug,
    om.role,
    o.plan
  from public.orgs o
  inner join public.org_members om on om.org_id = o.id
  inner join public.user_preferences up on up.active_org_id = o.id
  where om.user_id = auth.uid()
    and up.user_id = auth.uid()
  limit 1;
$$;
alter function public.get_active_workspace() set row_security = off;

-- SET ACTIVE WORKSPACE RPC
create or replace function public.set_active_workspace(p_org_id uuid)
returns table(
  org_id uuid,
  org_name text,
  org_slug text,
  role public.app_role
)
language plpgsql security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_role public.app_role;
begin
  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  if p_org_id is null then
    raise exception 'Organization ID is required.';
  end if;

  -- Verify user is member of this org
  select om.role into v_role
  from public.org_members om
  where om.org_id = p_org_id and om.user_id = v_user;

  if v_role is null then
    raise exception 'User is not a member of this workspace.';
  end if;

  -- Update active workspace
  insert into public.user_preferences (user_id, active_org_id)
  values (v_user, p_org_id)
  on conflict (user_id) do update
  set active_org_id = p_org_id, updated_at = now();

  return query
  select
    o.id,
    o.name,
    o.slug,
    v_role
  from public.orgs o
  where o.id = p_org_id;
end;
$$;
alter function public.set_active_workspace(uuid) set row_security = off;

-- CREATE NOTIFICATION RPC
create or replace function public.create_notification(
  p_recipient_email text,
  p_org_id uuid,
  p_type text,
  p_recipient_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns public.notifications
language plpgsql security definer set search_path = public as $$
declare
  v_notification public.notifications;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_recipient_email is null or btrim(p_recipient_email) = '' then
    raise exception 'Recipient email is required.';
  end if;

  if p_org_id is null then
    raise exception 'Organization ID is required.';
  end if;

  if p_type is null or btrim(p_type) = '' then
    raise exception 'Notification type is required.';
  end if;

  insert into public.notifications (
    recipient_id,
    recipient_email,
    org_id,
    type,
    payload
  ) values (
    p_recipient_id,
    lower(btrim(p_recipient_email)),
    p_org_id,
    p_type,
    coalesce(p_payload, '{}'::jsonb)
  )
  returning * into v_notification;

  return v_notification;
end;
$$;
alter function public.create_notification(text, uuid, text, uuid, jsonb) set row_security = off;

-- CREATE INVITATION RPC
create or replace function public.create_invitation(
  p_email text,
  p_org_id uuid,
  p_role public.app_role default 'member'::public.app_role,
  p_dashboard_ids uuid[] default '{}'::uuid[]
)
returns public.invitations
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations;
  v_sender uuid := auth.uid();
  v_is_admin boolean;
  v_recipient_id uuid;
begin
  if v_sender is null then
    raise exception 'Authentication required.';
  end if;

  if p_email is null or btrim(p_email) = '' then
    raise exception 'Invitee email is required.';
  end if;

  if p_org_id is null then
    raise exception 'Organization ID is required.';
  end if;

  -- Verify sender is org owner/admin
  select public.has_org_role(p_org_id, v_sender, array['owner','admin']::public.app_role[])
  into v_is_admin;

  if not v_is_admin then
    raise exception 'Only workspace owners and admins can send invitations.';
  end if;

  -- Check for existing pending invitation
  if exists (
    select 1 from public.invitations
    where org_id = p_org_id
      and lower(email) = lower(btrim(p_email))
      and status = 'pending'
  ) then
    raise exception 'A pending invitation already exists for this email.';
  end if;

  -- Delete expired invitations
  delete from public.invitations
  where org_id = p_org_id
    and status = 'pending'
    and expires_at <= now();

  -- Create invitation
  insert into public.invitations (
    email,
    org_id,
    role,
    invited_by,
    dashboard_ids,
    status
  ) values (
    lower(btrim(p_email)),
    p_org_id,
    p_role,
    v_sender,
    coalesce(p_dashboard_ids, '{}'::uuid[]),
    'pending'
  )
  returning * into v_invitation;

  -- Find recipient by email if exists
  select id into v_recipient_id
  from auth.users u
  where lower(u.email) = lower(btrim(p_email))
  limit 1;

  -- Create notification
  perform public.create_notification(
    lower(btrim(p_email)),
    p_org_id,
    'workspace_invite',
    v_recipient_id,
    jsonb_build_object(
      'invite_id', v_invitation.id,
      'token', v_invitation.token,
      'role', v_invitation.role,
      'invited_by', v_sender
    )
  );

  return v_invitation;
end;
$$;
alter function public.create_invitation(text, uuid, public.app_role, uuid[]) set row_security = off;

-- ACCEPT INVITATION RPC
create or replace function public.accept_invitation(p_token text)
returns table(
  org_id uuid,
  user_id uuid,
  role public.app_role
)
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations;
  v_acceptor uuid := auth.uid();
  v_inviter_email text;
  v_dashboard_id uuid;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invitation token is required.';
  end if;

  if v_acceptor is null then
    raise exception 'Authentication required.';
  end if;

  -- Get invitation
  select * into v_invitation
  from public.invitations i
  where i.token = p_token
  limit 1;

  if v_invitation.id is null then
    raise exception 'Invitation not found.';
  end if;

  -- Verify email match
  if lower(v_invitation.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Please sign in with the invited email to accept this invitation.';
  end if;

  -- Verify pending status
  if v_invitation.status <> 'pending' then
    raise exception 'Invitation is no longer pending.';
  end if;

  -- Verify not expired
  if v_invitation.expires_at <= now() then
    raise exception 'Invitation has expired.';
  end if;

  -- Add user to org_members
  insert into public.org_members (org_id, user_id, role)
  values (v_invitation.org_id, v_acceptor, v_invitation.role)
  on conflict (org_id, user_id) do update
  set role = case
    when public.org_members.role = 'owner' then 'owner'
    when excluded.role = 'admin' then 'admin'
    else public.org_members.role
  end;

  -- Add dashboard permissions if any
  if array_length(v_invitation.dashboard_ids, 1) > 0 then
    foreach v_dashboard_id in array v_invitation.dashboard_ids loop
      insert into public.dashboard_permissions (dashboard_id, user_id, org_id)
      select d.id, v_acceptor, v_invitation.org_id
      from public.dashboards d
      where d.id = v_dashboard_id
        and d.org_id = v_invitation.org_id
      on conflict (dashboard_id, user_id) do nothing;
    end loop;
  end if;

  -- Mark as accepted
  update public.invitations
  set status = 'accepted', accepted_at = now(), updated_at = now()
  where id = v_invitation.id;

  -- Set as active workspace if user has no preference
  insert into public.user_preferences (user_id, active_org_id)
  values (v_acceptor, v_invitation.org_id)
  on conflict (user_id) do nothing;

  -- Notify inviter
  select email into v_inviter_email
  from auth.users u
  where u.id = v_invitation.invited_by
  limit 1;

  if v_inviter_email is not null then
    perform public.create_notification(
      v_inviter_email,
      v_invitation.org_id,
      'invite_accepted',
      v_invitation.invited_by,
      jsonb_build_object(
        'invite_id', v_invitation.id,
        'accepted_by_email', auth.jwt() ->> 'email'
      )
    );
  end if;

  return query select v_invitation.org_id, v_acceptor, v_invitation.role;
end;
$$;
alter function public.accept_invitation(text) set row_security = off;

-- REJECT INVITATION RPC
create or replace function public.reject_invitation(p_token text)
returns table(
  invitation_id uuid,
  status text
)
language plpgsql security definer set search_path = public as $$
declare
  v_invitation public.invitations;
  v_rejector uuid := auth.uid();
  v_inviter_email text;
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invitation token is required.';
  end if;

  if v_rejector is null then
    raise exception 'Authentication required.';
  end if;

  -- Get invitation
  select * into v_invitation
  from public.invitations i
  where i.token = p_token
  limit 1;

  if v_invitation.id is null then
    raise exception 'Invitation not found.';
  end if;

  -- Verify email match
  if lower(v_invitation.email) <> lower(auth.jwt() ->> 'email') then
    raise exception 'Please sign in with the invited email to reject this invitation.';
  end if;

  -- If already rejected/accepted, just return status
  if v_invitation.status <> 'pending' then
    return query select v_invitation.id, v_invitation.status;
    return;
  end if;

  -- Mark as rejected
  update public.invitations
  set status = 'rejected', rejected_at = now(), updated_at = now()
  where id = v_invitation.id;

  -- Notify inviter
  select email into v_inviter_email
  from auth.users u
  where u.id = v_invitation.invited_by
  limit 1;

  if v_inviter_email is not null then
    perform public.create_notification(
      v_inviter_email,
      v_invitation.org_id,
      'invite_rejected',
      v_invitation.invited_by,
      jsonb_build_object(
        'invite_id', v_invitation.id,
        'rejected_by_email', auth.jwt() ->> 'email'
      )
    );
  end if;

  return query select v_invitation.id, 'rejected';
end;
$$;
alter function public.reject_invitation(text) set row_security = off;

-- STEP 8: GET INVITATIONS FOR ORG (for members page)
create or replace function public.get_org_invitations(p_org_id uuid)
returns table(
  id uuid,
  email text,
  role public.app_role,
  status text,
  created_at timestamptz,
  invited_by uuid,
  inviter_email text,
  inviter_display_name text,
  token text
)
language sql stable security definer set search_path = public as $$
  select
    i.id,
    i.email,
    i.role,
    i.status,
    i.created_at,
    i.invited_by,
    au.email as inviter_email,
    coalesce(pr.display_name, au.email, 'Unknown') as inviter_display_name,
    i.token
  from public.invitations i
  left join auth.users au on au.id = i.invited_by
  left join public.profiles pr on pr.id = i.invited_by
  where i.org_id = p_org_id
    and i.status = 'pending'
  order by i.created_at desc;
$$;
alter function public.get_org_invitations(uuid) set row_security = off;

-- STEP 9: CLEANUP EXPIRED INVITATIONS -----------------------------------------------

delete from public.invitations
where status = 'pending'
  and expires_at <= now();

-- STEP 10: FINAL NOTIFICATIONS -----------------------------------------------

select pg_notify('pgrst', 'reload schema');

COMMIT;
