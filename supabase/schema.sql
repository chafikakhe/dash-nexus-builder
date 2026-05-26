-- ============================================================
-- DashForge — Multi-tenant schema (run in Supabase SQL editor)
-- Idempotent: safe to re-run during development.
-- ============================================================

do $$ begin
  create type public.app_role as enum ('owner', 'admin', 'editor', 'viewer');
exception when duplicate_object then null; end $$;

alter type public.app_role add value if not exists 'member';

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create table if not exists public.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  plan text not null default 'free',
  owner_id uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.orgs enable row level security;
alter table public.orgs add column if not exists owner_id uuid references auth.users(id) on delete set null;

create table if not exists public.org_members (
  org_id uuid references public.orgs(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
alter table public.org_members enable row level security;

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

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references auth.users(id) on delete cascade,
  recipient_email text not null,
  org_id uuid references public.orgs(id) on delete cascade,
  type text not null check (type in ('workspace_invite','system','invite_accepted')),
  payload jsonb not null default '{}'::jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete set null,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  resource_type text not null default 'workspace',
  resource_name text,
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.activity_log enable row level security;
create index if not exists activity_log_org_idx on public.activity_log(org_id);
create index if not exists activity_log_user_idx on public.activity_log(user_id);
create index if not exists activity_log_created_at_idx on public.activity_log(created_at desc);

drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select to authenticated
  using (
    recipient_id = auth.uid()
    or lower(recipient_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "notifications_insert" on public.notifications;
create policy "notifications_insert" on public.notifications
  for insert to authenticated
  with check (
    recipient_id = auth.uid()
    or lower(recipient_email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

drop policy if exists "notifications_delete" on public.notifications;
create policy "notifications_delete" on public.notifications
  for delete to authenticated
  using (recipient_id = auth.uid());

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select to authenticated
  using (
    org_id is not null
    and public.is_org_member(org_id, auth.uid())
  );

create or replace function public.create_notification(
  _recipient_email text,
  _org_id uuid,
  _type text,
  _recipient_id uuid default null,
  _payload jsonb default '{}'
)
returns public.notifications
language plpgsql security definer set search_path = public as $$
declare
  notification_row public.notifications;
begin
  if _recipient_email is null or btrim(_recipient_email) = '' then
    raise exception 'Recipient email is required for notification.';
  end if;

  if _org_id is null then
    raise exception 'Organization ID is required for notification.';
  end if;

  if _type is null or btrim(_type) = '' then
    raise exception 'Notification type is required.';
  end if;

  insert into public.notifications (recipient_id, recipient_email, org_id, type, payload)
  values (_recipient_id, lower(trim(_recipient_email)), _org_id, _type, coalesce(_payload, '{}'::jsonb))
  returning * into notification_row;

  return notification_row;
end;
$$;
alter function public.create_notification(text, uuid, text, uuid, jsonb) set row_security = off;

create or replace function public.delete_workspace(p_org_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid := auth.uid();
  v_workspace public.orgs%rowtype;
  v_role public.app_role;
  v_audit_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required to delete workspace.';
  end if;

  if p_org_id is null then
    raise exception 'Workspace ID is required.';
  end if;

  select *
  into v_workspace
  from public.orgs
  where id = p_org_id;

  if not found then
    raise exception 'Workspace not found.';
  end if;

  select om.role
  into v_role
  from public.org_members om
  where om.org_id = p_org_id
    and om.user_id = v_user_id
  limit 1;

  if v_role is distinct from 'owner'::public.app_role then
    raise exception 'Only the workspace owner can delete this workspace.';
  end if;

  insert into public.activity_log (
    org_id,
    user_id,
    action,
    resource_type,
    resource_name,
    message,
    metadata
  )
  values (
    p_org_id,
    v_user_id,
    'workspace_deleted',
    'workspace',
    v_workspace.name,
    'Owner deleted workspace',
    jsonb_build_object(
      'workspace_id', v_workspace.id,
      'workspace_name', v_workspace.name,
      'workspace_slug', v_workspace.slug
    )
  )
  returning id into v_audit_id;

  if to_regclass('public.user_preferences') is not null then
    delete from public.user_preferences
    where active_org_id = p_org_id;
  end if;

  if to_regclass('public.collection_records') is not null then
    delete from public.collection_records
    where org_id = p_org_id;
  end if;

  if to_regclass('public.imports') is not null then
    delete from public.imports
    where org_id = p_org_id;
  end if;

  delete from public.collections
  where org_id = p_org_id
     or workspace_id = p_org_id;

  delete from public.dashboard_permissions
  where org_id = p_org_id;

  delete from public.dashboards
  where org_id = p_org_id;

  if to_regclass('public.api_connections') is not null then
    delete from public.api_connections
    where org_id = p_org_id
       or workspace_id = p_org_id;
  end if;

  delete from public.invitations
  where org_id = p_org_id;

  delete from public.notifications
  where org_id = p_org_id;

  delete from public.org_members
  where org_id = p_org_id;

  delete from public.activity_log
  where org_id = p_org_id
    and id <> v_audit_id;

  delete from public.orgs
  where id = p_org_id;

  return jsonb_build_object(
    'success', true,
    'workspace_id', v_workspace.id,
    'workspace_name', v_workspace.name
  );
end;
$$;
alter function public.delete_workspace(uuid) set row_security = off;

create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  description text,
  layout jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboards enable row level security;
create index if not exists dashboards_org_idx on public.dashboards(org_id);

create table if not exists public.dashboard_permissions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (dashboard_id, user_id)
);
alter table public.dashboard_permissions enable row level security;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id) on delete cascade,
  name text not null,
  schema jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.collections enable row level security;
create index if not exists collections_org_idx on public.collections(org_id);

create or replace function public.is_org_member(_org uuid, _user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.org_members where org_id = _org and user_id = _user)
$$;

create or replace function public.has_org_role(_org uuid, _user uuid, _roles public.app_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.org_members
    where org_id = _org and user_id = _user and role = any(_roles)
  )
$$;

drop policy if exists "profiles_self_select" on public.profiles;
create policy "profiles_self_select" on public.profiles
  for select to authenticated using (
    id = auth.uid()
    or exists (
      select 1
      from public.org_members self_org
      join public.org_members peer_org on peer_org.org_id = self_org.org_id
      where self_org.user_id = auth.uid()
        and peer_org.user_id = public.profiles.id
    )
  );

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "profiles_self_insert" on public.profiles;
create policy "profiles_self_insert" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "orgs_member_select" on public.orgs;
create policy "orgs_member_select" on public.orgs
  for select to authenticated using (public.is_org_member(id, auth.uid()));

drop policy if exists "orgs_insert_authenticated" on public.orgs;
drop policy if exists "Users can create their own workspace" on public.orgs;
create policy "Users can create their own workspace" on public.orgs
  for insert to authenticated
  with check (
    auth.uid() = owner_id
    OR auth.uid() = created_by
  );

drop policy if exists "orgs_owner_update" on public.orgs;
create policy "orgs_owner_update" on public.orgs
  for update to authenticated
  using (public.has_org_role(id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "members_select" on public.org_members;
create policy "members_select" on public.org_members
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "members_insert_admin" on public.org_members;
create policy "members_insert_admin" on public.org_members
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or not exists (select 1 from public.org_members where org_id = org_members.org_id)
  );

drop policy if exists "members_update_admin" on public.org_members;
create policy "members_update_admin" on public.org_members
  for update to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "members_delete_admin" on public.org_members;
create policy "members_delete_admin" on public.org_members
  for delete to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "invitations_select" on public.invitations;
create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or lower(email) = lower(auth.jwt() ->> 'email')
    or invited_by = auth.uid()
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
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or lower(email) = lower(auth.jwt() ->> 'email')
  )
  with check (
    (status != 'accepted')
    or lower(email) = lower(auth.jwt() ->> 'email')
  );

drop policy if exists "invitations_delete" on public.invitations;
create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or invited_by = auth.uid()
  );

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
  if lower(_invited_by::text) <> lower(auth.uid()::text) then
    raise exception 'Invited by must be the logged in user.';
  end if;

  select exists(
    select 1 from public.org_members
    where org_id = _org_id
      and user_id = auth.uid()
      and role = any(array['owner','admin']::public.app_role[])
  ) into invite_exists;

  if not invite_exists then
    raise exception 'Only workspace owners and admins can invite new members.';
  end if;

  select exists(
    select 1 from public.invitations
    where org_id = _org_id and lower(email) = lower(trim(_email)) and status = 'pending'
  ) into invite_exists;

  if invite_exists then
    raise exception 'An invitation is already pending for %', _email;
  end if;

  insert into public.invitations (email, org_id, role, invited_by, dashboard_ids, status)
  values (lower(trim(_email)), _org_id, _role, _invited_by, coalesce(_dashboard_ids, '{}'), 'pending')
  returning * into invite_row;

  raise notice 'create_invitation: org=% inviter=% email=% pending=%', _org_id, _invited_by, lower(trim(_email)), invite_exists;

  perform public.create_notification(
    lower(trim(_email)),
    _org_id,
    'workspace_invite',
    (select id from auth.users u where lower(u.email) = lower(trim(_email)) limit 1),
    jsonb_build_object(
      'invite_id', invite_row.id,
      'token', invite_row.token,
      'role', invite_row.role,
      'invited_by', invite_row.invited_by
    )
  );

  return invite_row;
end;
$$;
alter function public.create_invitation(text, uuid, text, uuid, uuid[]) set row_security = off;

drop policy if exists "dashboards_select" on public.dashboards;
create policy "dashboards_select" on public.dashboards
  for select to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
    or exists (
      select 1 from public.dashboard_permissions dp
      where dp.dashboard_id = public.dashboards.id
        and dp.user_id = auth.uid()
    )
  );

drop policy if exists "dashboards_insert" on public.dashboards;
create policy "dashboards_insert" on public.dashboards
  for insert to authenticated with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboards_update" on public.dashboards;
create policy "dashboards_update" on public.dashboards
  for update to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboards_delete" on public.dashboards;
create policy "dashboards_delete" on public.dashboards
  for delete to authenticated using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "collections_select" on public.collections;
create policy "collections_select" on public.collections
  for select to authenticated using (public.is_org_member(org_id, auth.uid()));

drop policy if exists "collections_write" on public.collections;
create policy "collections_write" on public.collections
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

drop policy if exists "dashboard_permissions_select" on public.dashboard_permissions;
create policy "dashboard_permissions_select" on public.dashboard_permissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "dashboard_permissions_write" on public.dashboard_permissions;
create policy "dashboard_permissions_write" on public.dashboard_permissions
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[]));

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.handle_new_org()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.org_members (org_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists on_org_created on public.orgs;
create trigger on_org_created
  after insert on public.orgs
  for each row execute function public.handle_new_org();

-- Admin extension:
alter table public.profiles
  add column if not exists is_admin boolean not null default false;

create or replace function public.is_platform_admin(_user uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select is_admin from public.profiles where id = _user),
    false
  )
$$;

drop policy if exists "profiles_admin_update" on public.profiles;
create policy "profiles_admin_update" on public.profiles
  for update to authenticated
  using (public.is_platform_admin(auth.uid()))
  with check (public.is_platform_admin(auth.uid()));

drop policy if exists "orgs_admin_select" on public.orgs;
create policy "orgs_admin_select" on public.orgs
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "members_admin_select" on public.org_members;
create policy "members_admin_select" on public.org_members
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "dashboards_admin_select" on public.dashboards;
create policy "dashboards_admin_select" on public.dashboards
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

drop policy if exists "collections_admin_select" on public.collections;
create policy "collections_admin_select" on public.collections
  for select to authenticated
  using (public.is_platform_admin(auth.uid()));

create table if not exists public.collection_records (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.collection_records enable row level security;
create index if not exists records_collection_idx on public.collection_records(collection_id);
create index if not exists records_org_idx on public.collection_records(org_id);

drop policy if exists "records_select" on public.collection_records;
create policy "records_select" on public.collection_records
  for select to authenticated
  using (
    public.is_org_member(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "records_write" on public.collection_records;
create policy "records_write" on public.collection_records
  for all to authenticated
  using (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]))
  with check (public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[]));

-- Signal PostgREST to reload schema cache (fixes "Could not find the function" errors)
notify pgrst, 'reload schema';
