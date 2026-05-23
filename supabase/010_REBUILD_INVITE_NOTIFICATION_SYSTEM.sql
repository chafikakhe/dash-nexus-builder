-- 010_REBUILD_INVITE_NOTIFICATION_SYSTEM.sql
-- Full reset of invitations, notifications, dashboard permissions, and related RLS/policies.
-- This migration clears old broken objects and rebuilds a clean, production-ready system.

BEGIN;

-- CLEANUP LEGACY OBJECTS ---------------------------------------------------

DROP VIEW IF EXISTS public.workspace_invitations CASCADE;

DROP POLICY IF EXISTS "invitations_select" ON public.invitations;
DROP POLICY IF EXISTS "invitations_insert" ON public.invitations;
DROP POLICY IF EXISTS "invitations_update" ON public.invitations;
DROP POLICY IF EXISTS "invitations_delete" ON public.invitations;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;

DROP POLICY IF EXISTS "members_select" ON public.org_members;
DROP POLICY IF EXISTS "members_insert_admin" ON public.org_members;
DROP POLICY IF EXISTS "members_update_admin" ON public.org_members;
DROP POLICY IF EXISTS "members_delete_admin" ON public.org_members;

DROP POLICY IF EXISTS "dashboards_select" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_insert" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_update" ON public.dashboards;
DROP POLICY IF EXISTS "dashboards_delete" ON public.dashboards;

DROP FUNCTION IF EXISTS public.create_invitation(text, uuid, public.app_role, uuid[]);
DROP FUNCTION IF EXISTS public.accept_invitation(text);
DROP FUNCTION IF EXISTS public.reject_invitation(text);
DROP FUNCTION IF EXISTS public.create_notification(text, uuid, text, uuid, jsonb);

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS notifications_on_user_insert ON auth.users;

DROP INDEX IF EXISTS invitations_token_idx;
DROP INDEX IF EXISTS invitations_org_idx;
DROP INDEX IF EXISTS invitations_email_idx;
DROP INDEX IF EXISTS org_members_org_user_uidx;
DROP INDEX IF EXISTS org_members_user_idx;
DROP INDEX IF EXISTS dashboard_permissions_dashboard_user_uidx;
DROP INDEX IF EXISTS dashboard_permissions_org_idx;
DROP INDEX IF EXISTS notifications_recipient_email_idx;
DROP INDEX IF EXISTS notifications_recipient_id_idx;
DROP INDEX IF EXISTS notifications_org_idx;

DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.dashboard_permissions CASCADE;
DROP TABLE IF EXISTS public.invitations CASCADE;

-- NOTE: org_members and orgs remain to preserve workspace membership data.
-- If you want to reset memberships completely, drop public.org_members explicitly.

-- BUILD CLEAN TYPE AND TABLES ---------------------------------------------

do $$ begin
  create type public.app_role as enum ('owner','admin','member','editor','viewer');
exception when duplicate_object then null; end $$;

alter type public.app_role add value if not exists 'member';
alter type public.app_role add value if not exists 'editor';
alter type public.app_role add value if not exists 'viewer';

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.org_members (
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create table public.invitations (
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
  created_at timestamptz not null default now()
);

create table public.dashboard_permissions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dashboard_id, user_id)
);

create table public.notifications (
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

-- INDEXES ------------------------------------------------------------------
create unique index if not exists org_members_org_user_uindex on public.org_members (org_id, user_id);
create index if not exists org_members_user_idx on public.org_members (user_id);

create unique index if not exists invitations_token_idx on public.invitations (token);
create index if not exists invitations_org_idx on public.invitations (org_id);
create index if not exists invitations_email_idx on public.invitations (lower(email));
create index if not exists invitations_expires_idx on public.invitations (expires_at);

create unique index if not exists dashboard_permissions_dashboard_user_uindex on public.dashboard_permissions (dashboard_id, user_id);
create index if not exists dashboard_permissions_org_idx on public.dashboard_permissions (org_id);

create index if not exists notifications_recipient_id_idx on public.notifications (recipient_id);
create index if not exists notifications_recipient_email_idx on public.notifications (lower(recipient_email));
create index if not exists notifications_org_idx on public.notifications (org_id);

-- RLS POLICIES -------------------------------------------------------------

alter table public.org_members enable row level security;
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
    user_id = public.org_members.user_id
    and org_id = public.org_members.org_id
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

alter table public.invitations enable row level security;
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
    or public.invitations.invited_by = auth.uid()
  );

create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (
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
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
  )
  with check (
    public.invitations.status in ('pending','rejected')
    or lower(public.invitations.email) = lower(auth.jwt() ->> 'email')
  );

create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    exists (
      select 1 from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = any(array['owner','admin']::public.app_role[])
    )
    or public.invitations.invited_by = auth.uid()
  );

alter table public.dashboard_permissions enable row level security;
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

alter table public.notifications enable row level security;
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

-- CORE HELPERS -------------------------------------------------------------

create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = _user
  );
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = _user and role = any(_roles)
  );
$$;

-- RPC FUNCTIONS ------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.create_notification(
  _recipient_email text,
  _org_id uuid,
  _type text,
  _recipient_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'
)
RETURNS public.notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  notification_row public.notifications;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create notification.';
  END IF;

  IF _recipient_email IS NULL OR btrim(_recipient_email) = '' THEN
    RAISE EXCEPTION 'Recipient email is required for notification.';
  END IF;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Organization ID is required for notification.';
  END IF;

  IF _type IS NULL OR btrim(_type) = '' THEN
    RAISE EXCEPTION 'Notification type is required.';
  END IF;

  INSERT INTO public.notifications (recipient_id, recipient_email, org_id, type, payload)
  VALUES (
    _recipient_id,
    lower(trim(_recipient_email)),
    _org_id,
    _type,
    coalesce(_payload, '{}'::jsonb)
  )
  RETURNING * INTO notification_row;

  RETURN notification_row;
END;
$$;
ALTER FUNCTION public.create_notification(text, uuid, text, uuid, jsonb) SET row_security = off;

CREATE OR REPLACE FUNCTION public.create_invitation(
  p_email text,
  p_org_id uuid,
  p_role public.app_role default 'member',
  p_dashboard_ids uuid[] default '{}'
)
RETURNS public.invitations
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation public.invitations%rowtype;
  v_sender uuid := auth.uid();
  v_existing boolean;
  v_recipient uuid;
BEGIN
  IF v_sender IS NULL THEN
    RAISE EXCEPTION 'Authentication required to create invitation.';
  END IF;

  IF p_email IS NULL OR btrim(p_email) = '' THEN
    RAISE EXCEPTION 'Invitee email is required.';
  END IF;

  IF p_org_id IS NULL THEN
    RAISE EXCEPTION 'Organization ID is required.';
  END IF;

  DELETE FROM public.invitations
  WHERE status = 'pending'
    AND expires_at <= now();

  SELECT EXISTS (
    SELECT 1 FROM public.org_members
    WHERE org_id = p_org_id
      AND user_id = v_sender
      AND role = ANY(array['owner','admin']::public.app_role[])
  ) INTO v_existing;

  IF NOT v_existing THEN
    RAISE EXCEPTION 'Only workspace owners and admins can send invitations.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.invitations
    WHERE org_id = p_org_id
      AND lower(email) = lower(trim(p_email))
      AND status = 'pending'
  ) INTO v_existing;

  IF v_existing THEN
    RAISE EXCEPTION 'A pending invitation already exists for %', p_email;
  END IF;

  INSERT INTO public.invitations (email, org_id, role, invited_by, dashboard_ids, status)
  VALUES (
    lower(trim(p_email)),
    p_org_id,
    p_role,
    v_sender,
    coalesce(p_dashboard_ids, '{}'),
    'pending'
  )
  RETURNING * INTO v_invitation;

  SELECT id INTO v_recipient
  FROM auth.users u
  WHERE lower(u.email) = lower(trim(p_email))
  LIMIT 1;

  PERFORM public.create_notification(
    lower(trim(p_email)),
    p_org_id,
    'workspace_invite',
    v_recipient,
    jsonb_build_object(
      'invite_id', v_invitation.id,
      'token', v_invitation.token,
      'role', v_invitation.role,
      'invited_by', v_sender
    )
  );

  RETURN v_invitation;
END;
$$;
ALTER FUNCTION public.create_invitation(text, uuid, public.app_role, uuid[]) SET row_security = off;

CREATE OR REPLACE FUNCTION public.accept_invitation(
  p_token text
)
RETURNS TABLE(org_id uuid, user_id uuid, role public.app_role)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation public.invitations%rowtype;
  v_acceptor uuid := auth.uid();
  v_inviter_email text;
  v_dashboard_id uuid;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invitation token is required.';
  END IF;

  IF v_acceptor IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation.';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations i
  WHERE i.token = p_token
  LIMIT 1;

  IF NOT FOUND OR v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  IF lower(v_invitation.email) <> lower(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Please sign in with the invited email to accept this invitation.';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation is no longer pending.';
  END IF;

  IF v_invitation.expires_at <= now() THEN
    RAISE EXCEPTION 'Invitation has expired.';
  END IF;

  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_invitation.org_id, v_acceptor, v_invitation.role)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = CASE
      WHEN public.org_members.role = 'owner' THEN 'owner'
      WHEN EXCLUDED.role = 'admin' THEN 'admin'
      ELSE public.org_members.role
    END;

  IF array_length(v_invitation.dashboard_ids, 1) IS NOT NULL THEN
    FOREACH v_dashboard_id IN ARRAY v_invitation.dashboard_ids LOOP
      INSERT INTO public.dashboard_permissions (dashboard_id, user_id, org_id)
      SELECT d.id, v_acceptor, v_invitation.org_id
      FROM public.dashboards d
      WHERE d.id = v_dashboard_id
        AND d.org_id = v_invitation.org_id
      ON CONFLICT (dashboard_id, user_id) DO NOTHING;
    END LOOP;
  END IF;

  UPDATE public.invitations
  SET status = 'accepted', accepted_at = now()
  WHERE id = v_invitation.id;

  SELECT email INTO v_inviter_email
  FROM auth.users u
  WHERE u.id = v_invitation.invited_by
  LIMIT 1;

  IF v_inviter_email IS NOT NULL THEN
    PERFORM public.create_notification(
      lower(v_inviter_email),
      v_invitation.org_id,
      'invite_accepted',
      v_invitation.invited_by,
      jsonb_build_object(
        'invite_id', v_invitation.id,
        'accepted_by', v_acceptor
      )
    );
  END IF;

  RETURN QUERY SELECT v_invitation.org_id, v_acceptor, v_invitation.role;
END;
$$;
ALTER FUNCTION public.accept_invitation(text) SET row_security = off;

CREATE OR REPLACE FUNCTION public.reject_invitation(
  p_token text
)
RETURNS TABLE(invitation_id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_invitation public.invitations%rowtype;
  v_rejector uuid := auth.uid();
  v_inviter_email text;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invitation token is required.';
  END IF;

  IF v_rejector IS NULL THEN
    RAISE EXCEPTION 'Authentication required to reject invitation.';
  END IF;

  SELECT * INTO v_invitation
  FROM public.invitations i
  WHERE i.token = p_token
  LIMIT 1;

  IF NOT FOUND OR v_invitation.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  IF lower(v_invitation.email) <> lower(auth.jwt() ->> 'email') THEN
    RAISE EXCEPTION 'Please sign in with the invited email to reject this invitation.';
  END IF;

  IF v_invitation.status <> 'pending' THEN
    RETURN QUERY SELECT v_invitation.id, v_invitation.status;
    RETURN;
  END IF;

  IF v_invitation.expires_at <= now() THEN
    UPDATE public.invitations
    SET status = 'rejected', rejected_at = now()
    WHERE id = v_invitation.id;
    RETURN QUERY SELECT v_invitation.id, 'rejected';
    RETURN;
  END IF;

  UPDATE public.invitations
  SET status = 'rejected', rejected_at = now()
  WHERE id = v_invitation.id;

  SELECT email INTO v_inviter_email
  FROM auth.users u
  WHERE u.id = v_invitation.invited_by
  LIMIT 1;

  IF v_inviter_email IS NOT NULL THEN
    PERFORM public.create_notification(
      lower(v_inviter_email),
      v_invitation.org_id,
      'invite_rejected',
      v_invitation.invited_by,
      jsonb_build_object(
        'invite_id', v_invitation.id,
        'rejected_by', v_rejector
      )
    );
  END IF;

  RETURN QUERY SELECT v_invitation.id, 'rejected';
END;
$$;
ALTER FUNCTION public.reject_invitation(text) SET row_security = off;

-- CLEANUP STALE INVITES -----------------------------------------------------
DELETE FROM public.invitations
WHERE status = 'pending'
  AND expires_at <= now();

-- REFRESH SCHEMA -----------------------------------------------------------
SELECT pg_notify('pgrst', 'reload schema');

COMMIT;
