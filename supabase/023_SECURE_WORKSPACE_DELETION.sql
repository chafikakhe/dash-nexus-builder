begin;

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

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select to authenticated
  using (
    org_id is not null
    and public.is_org_member(org_id, auth.uid())
  );

create or replace function public.delete_workspace(p_org_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

grant select on public.activity_log to authenticated;
grant execute on function public.delete_workspace(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
