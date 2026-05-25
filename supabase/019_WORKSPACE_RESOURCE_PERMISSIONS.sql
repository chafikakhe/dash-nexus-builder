-- Resource-level workspace permissions.
--
-- This migration is intentionally additive around the existing invitation flow:
-- it does not drop, recreate, or change the return type of public.accept_invitation(text).
--
-- Rules:
-- - owner/admin can view and edit all resources in their workspace.
-- - member can select only dashboards/collections explicitly shared with them.
-- - member cannot write unless a DB-level edit grant exists.
-- - frontend keeps members read-only.

create table if not exists public.dashboard_permissions (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid references public.orgs(id) on delete cascade,
  permission text not null default 'view',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.dashboard_permissions
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists org_id uuid references public.orgs(id) on delete cascade,
  add column if not exists permission text default 'view',
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now();

update public.dashboard_permissions dp
set org_id = d.org_id
from public.dashboards d
where dp.dashboard_id = d.id
  and dp.org_id is null;

update public.dashboard_permissions
set permission = case when permission = 'edit' then 'edit' else 'view' end
where permission is null or permission not in ('view','edit');

alter table public.dashboard_permissions
  alter column permission set not null,
  alter column created_at set not null,
  drop constraint if exists dashboard_permissions_permission_check,
  add constraint dashboard_permissions_permission_check check (permission in ('view','edit'));

create unique index if not exists dashboard_permissions_dashboard_user_uidx
  on public.dashboard_permissions(dashboard_id, user_id);
create index if not exists dashboard_permissions_org_user_idx
  on public.dashboard_permissions(org_id, user_id);
create index if not exists dashboard_permissions_user_dashboard_idx
  on public.dashboard_permissions(user_id, dashboard_id);

create table if not exists public.collection_permissions (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null default 'view' check (permission in ('view','edit')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists collection_permissions_collection_user_uidx
  on public.collection_permissions(collection_id, user_id);
create index if not exists collection_permissions_org_user_idx
  on public.collection_permissions(org_id, user_id);
create index if not exists collection_permissions_user_collection_idx
  on public.collection_permissions(user_id, collection_id);

alter table public.invitations
  add column if not exists dashboard_permissions jsonb not null default '[]'::jsonb,
  add column if not exists collection_permissions jsonb not null default '[]'::jsonb,
  add column if not exists collection_ids uuid[] not null default '{}';

create or replace function public.can_manage_org(p_org uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.org_members om
    where om.org_id = p_org
      and om.user_id = p_user
      and om.role in ('owner','admin')
  );
$$;

create or replace function public.can_view_dashboard(p_dashboard uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dashboards d
    where d.id = p_dashboard
      and (
        public.can_manage_org(d.org_id, p_user)
        or exists (
          select 1
          from public.dashboard_permissions dp
          where dp.dashboard_id = d.id
            and dp.user_id = p_user
            and dp.permission in ('view','edit')
        )
      )
  );
$$;

create or replace function public.can_edit_dashboard(p_dashboard uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.dashboards d
    where d.id = p_dashboard
      and (
        public.can_manage_org(d.org_id, p_user)
        or exists (
          select 1
          from public.dashboard_permissions dp
          where dp.dashboard_id = d.id
            and dp.user_id = p_user
            and dp.permission = 'edit'
        )
      )
  );
$$;

create or replace function public.can_view_collection(p_collection uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collections c
    where c.id = p_collection
      and (
        public.can_manage_org(c.org_id, p_user)
        or exists (
          select 1
          from public.collection_permissions cp
          where cp.collection_id = c.id
            and cp.user_id = p_user
            and cp.permission in ('view','edit')
        )
      )
  );
$$;

create or replace function public.can_edit_collection(p_collection uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.collections c
    where c.id = p_collection
      and (
        public.can_manage_org(c.org_id, p_user)
        or exists (
          select 1
          from public.collection_permissions cp
          where cp.collection_id = c.id
            and cp.user_id = p_user
            and cp.permission = 'edit'
        )
      )
  );
$$;

grant execute on function public.can_manage_org(uuid, uuid) to authenticated;
grant execute on function public.can_view_dashboard(uuid, uuid) to authenticated;
grant execute on function public.can_edit_dashboard(uuid, uuid) to authenticated;
grant execute on function public.can_view_collection(uuid, uuid) to authenticated;
grant execute on function public.can_edit_collection(uuid, uuid) to authenticated;

alter table public.dashboard_permissions enable row level security;
alter table public.collection_permissions enable row level security;

drop policy if exists "dashboard_permissions_select" on public.dashboard_permissions;
drop policy if exists "dashboard_permissions_write" on public.dashboard_permissions;
drop policy if exists "dashboard_permissions_insert" on public.dashboard_permissions;
drop policy if exists "dashboard_permissions_delete" on public.dashboard_permissions;

create policy "dashboard_permissions_select" on public.dashboard_permissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "dashboard_permissions_write" on public.dashboard_permissions
  for all to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "collection_permissions_select" on public.collection_permissions;
drop policy if exists "collection_permissions_write" on public.collection_permissions;
drop policy if exists "collection_permissions_insert" on public.collection_permissions;
drop policy if exists "collection_permissions_delete" on public.collection_permissions;

create policy "collection_permissions_select" on public.collection_permissions
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "collection_permissions_write" on public.collection_permissions
  for all to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "dashboards_select" on public.dashboards;
drop policy if exists "dashboards_insert" on public.dashboards;
drop policy if exists "dashboards_update" on public.dashboards;
drop policy if exists "dashboards_delete" on public.dashboards;

create policy "dashboards_select" on public.dashboards
  for select to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.can_view_dashboard(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "dashboards_insert" on public.dashboards
  for insert to authenticated
  with check (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "dashboards_update" on public.dashboards
  for update to authenticated
  using (
    public.can_edit_dashboard(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_edit_dashboard(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "dashboards_delete" on public.dashboards
  for delete to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "collections_select" on public.collections;
drop policy if exists "collections_write" on public.collections;
drop policy if exists "collections_insert" on public.collections;
drop policy if exists "collections_update" on public.collections;
drop policy if exists "collections_delete" on public.collections;

create policy "collections_select" on public.collections
  for select to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.can_view_collection(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "collections_insert" on public.collections
  for insert to authenticated
  with check (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "collections_update" on public.collections
  for update to authenticated
  using (
    public.can_edit_collection(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_edit_collection(id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "collections_delete" on public.collections
  for delete to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "records_select" on public.collection_records;
drop policy if exists "records_write" on public.collection_records;
drop policy if exists "records_insert" on public.collection_records;
drop policy if exists "records_update" on public.collection_records;
drop policy if exists "records_delete" on public.collection_records;

create policy "records_select" on public.collection_records
  for select to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.can_view_collection(collection_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "records_write" on public.collection_records
  for all to authenticated
  using (
    public.can_edit_collection(collection_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_edit_collection(collection_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "dashboard_widgets_select" on public.dashboard_widgets;
drop policy if exists "dashboard_widgets_write" on public.dashboard_widgets;

create policy "dashboard_widgets_select" on public.dashboard_widgets
  for select to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.can_view_dashboard(dashboard_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "dashboard_widgets_write" on public.dashboard_widgets
  for all to authenticated
  using (
    public.can_edit_dashboard(dashboard_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_edit_dashboard(dashboard_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "members_select" on public.org_members;
drop policy if exists "members_admin_select" on public.org_members;
drop policy if exists "org_members_select" on public.org_members;

create policy "org_members_select" on public.org_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create or replace function public.create_invitation(
  p_email text,
  p_org_id uuid,
  p_role public.app_role default 'member'::public.app_role,
  p_dashboard_permissions jsonb default '[]'::jsonb,
  p_collection_permissions jsonb default '[]'::jsonb
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_sender uuid := auth.uid();
begin
  if v_sender is null then
    raise exception 'Authentication required to create invitation.';
  end if;

  if p_role not in ('admin'::public.app_role, 'member'::public.app_role) then
    raise exception 'Invitations can only assign admin or member roles.';
  end if;

  if not public.can_manage_org(p_org_id, v_sender) then
    raise exception 'Only workspace owners and admins can send invitations.';
  end if;

  if p_role = 'member'::public.app_role
    and jsonb_array_length(coalesce(p_dashboard_permissions, '[]'::jsonb)) = 0
    and jsonb_array_length(coalesce(p_collection_permissions, '[]'::jsonb)) = 0 then
    raise exception 'Members must be granted access to at least one dashboard or collection.';
  end if;

  delete from public.invitations
  where org_id = p_org_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending';

  insert into public.invitations (
    email,
    org_id,
    role,
    invited_by,
    dashboard_ids,
    collection_ids,
    dashboard_permissions,
    collection_permissions,
    status
  )
  values (
    lower(trim(p_email)),
    p_org_id,
    p_role,
    v_sender,
    array(select (item->>'dashboard_id')::uuid from jsonb_array_elements(coalesce(p_dashboard_permissions, '[]'::jsonb)) as item),
    array(select (item->>'collection_id')::uuid from jsonb_array_elements(coalesce(p_collection_permissions, '[]'::jsonb)) as item),
    coalesce(p_dashboard_permissions, '[]'::jsonb),
    coalesce(p_collection_permissions, '[]'::jsonb),
    'pending'
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

grant execute on function public.create_invitation(text, uuid, public.app_role, jsonb, jsonb) to authenticated;

create or replace function public.apply_invitation_resource_permissions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_item jsonb;
begin
  if TG_OP = 'UPDATE' then
    if NEW.status <> 'accepted' or OLD.status = NEW.status then
      return NEW;
    end if;
    v_invitation := NEW;
  elsif TG_OP = 'DELETE' then
    v_invitation := OLD;
  else
    return null;
  end if;

  if v_user is null then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if lower(v_invitation.email) <> lower(coalesce(auth.jwt() ->> 'email', '')) then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if not exists (
    select 1
    from public.org_members om
    where om.org_id = v_invitation.org_id
      and om.user_id = v_user
  ) then
    if TG_OP = 'DELETE' then
      return OLD;
    end if;
    return NEW;
  end if;

  if v_invitation.role::text = 'member' then
    for v_item in
      select * from jsonb_array_elements(coalesce(v_invitation.dashboard_permissions, '[]'::jsonb))
    loop
      insert into public.dashboard_permissions (dashboard_id, org_id, user_id, permission, created_by)
      select d.id,
             d.org_id,
             v_user,
             case when v_item->>'permission' = 'edit' then 'edit' else 'view' end,
             v_invitation.invited_by
      from public.dashboards d
      where d.id = (v_item->>'dashboard_id')::uuid
        and d.org_id = v_invitation.org_id
      on conflict (dashboard_id, user_id) do update
      set permission = excluded.permission,
          org_id = excluded.org_id,
          created_by = excluded.created_by;
    end loop;

    if jsonb_array_length(coalesce(v_invitation.dashboard_permissions, '[]'::jsonb)) = 0
      and array_length(v_invitation.dashboard_ids, 1) > 0 then
      insert into public.dashboard_permissions (dashboard_id, org_id, user_id, permission, created_by)
      select d.id, d.org_id, v_user, 'view', v_invitation.invited_by
      from public.dashboards d
      where d.id = any(v_invitation.dashboard_ids)
        and d.org_id = v_invitation.org_id
      on conflict (dashboard_id, user_id) do update
      set permission = excluded.permission,
          org_id = excluded.org_id,
          created_by = excluded.created_by;
    end if;

    for v_item in
      select * from jsonb_array_elements(coalesce(v_invitation.collection_permissions, '[]'::jsonb))
    loop
      insert into public.collection_permissions (collection_id, org_id, user_id, permission, created_by)
      select c.id,
             c.org_id,
             v_user,
             case when v_item->>'permission' = 'edit' then 'edit' else 'view' end,
             v_invitation.invited_by
      from public.collections c
      where c.id = (v_item->>'collection_id')::uuid
        and c.org_id = v_invitation.org_id
      on conflict (collection_id, user_id) do update
      set permission = excluded.permission,
          org_id = excluded.org_id,
          created_by = excluded.created_by;
    end loop;

    if jsonb_array_length(coalesce(v_invitation.collection_permissions, '[]'::jsonb)) = 0
      and array_length(v_invitation.collection_ids, 1) > 0 then
      insert into public.collection_permissions (collection_id, org_id, user_id, permission, created_by)
      select c.id, c.org_id, v_user, 'view', v_invitation.invited_by
      from public.collections c
      where c.id = any(v_invitation.collection_ids)
        and c.org_id = v_invitation.org_id
      on conflict (collection_id, user_id) do update
      set permission = excluded.permission,
          org_id = excluded.org_id,
          created_by = excluded.created_by;
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists apply_invitation_resource_permissions_update on public.invitations;
create trigger apply_invitation_resource_permissions_update
  after update of status on public.invitations
  for each row
  execute function public.apply_invitation_resource_permissions();

drop trigger if exists apply_invitation_resource_permissions_delete on public.invitations;
create trigger apply_invitation_resource_permissions_delete
  before delete on public.invitations
  for each row
  execute function public.apply_invitation_resource_permissions();

notify pgrst, 'reload schema';
