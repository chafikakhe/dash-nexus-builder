alter table public.activity_log
  add column if not exists actor_name text;

update public.activity_log al
set actor_name = coalesce(pr.display_name, pr.email, al.actor_name, 'Unknown')
from public.profiles pr
where al.user_id = pr.id
  and (al.actor_name is null or btrim(al.actor_name) = '');

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select to authenticated
  using (
    org_id is not null
    and public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

create or replace function public.log_workspace_activity(
  p_org_id uuid,
  p_action text,
  p_target_type text default 'workspace',
  p_target_name text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.activity_log
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_actor_name text;
  v_entry public.activity_log;
begin
  if v_user_id is null then
    raise exception 'Authentication required to log workspace activity.';
  end if;

  if p_org_id is null then
    raise exception 'Workspace ID is required.';
  end if;

  if p_action is null or btrim(p_action) = '' then
    raise exception 'Action is required.';
  end if;

  if not public.is_org_member(p_org_id, v_user_id) then
    raise exception 'You do not have access to this workspace.';
  end if;

  select coalesce(pr.display_name, pr.email, auth.jwt() ->> 'email', 'Unknown')
  into v_actor_name
  from public.profiles pr
  where pr.id = v_user_id;

  v_actor_name := coalesce(v_actor_name, auth.jwt() ->> 'email', 'Unknown');

  insert into public.activity_log (
    org_id,
    user_id,
    actor_name,
    action,
    resource_type,
    resource_name,
    metadata,
    created_at
  )
  values (
    p_org_id,
    v_user_id,
    v_actor_name,
    btrim(p_action),
    coalesce(nullif(btrim(p_target_type), ''), 'workspace'),
    nullif(btrim(coalesce(p_target_name, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    now()
  )
  returning * into v_entry;

  return v_entry;
end;
$$;

alter function public.log_workspace_activity(uuid, text, text, text, jsonb) set row_security = off;
grant execute on function public.log_workspace_activity(uuid, text, text, text, jsonb) to authenticated;

create or replace function public.get_workspace_activity(
  p_org_id uuid,
  p_limit int default 100
)
returns table(
  id uuid,
  workspace_id uuid,
  user_id uuid,
  user_name text,
  action text,
  target_type text,
  target_name text,
  metadata jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_can_view_all boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required to view workspace activity.';
  end if;

  if p_org_id is null then
    raise exception 'Workspace ID is required.';
  end if;

  if not public.is_org_member(p_org_id, v_user_id) then
    raise exception 'You do not have access to this workspace.';
  end if;

  select public.has_org_role(
    p_org_id,
    v_user_id,
    array['owner','admin']::public.app_role[]
  )
  into v_can_view_all;

  if v_can_view_all then
    return query
    select
      al.id,
      al.org_id as workspace_id,
      al.user_id,
      coalesce(al.actor_name, pr.display_name, pr.email, 'Unknown') as user_name,
      al.action,
      coalesce(al.resource_type, 'workspace') as target_type,
      al.resource_name as target_name,
      coalesce(al.metadata, '{}'::jsonb) as metadata,
      al.created_at
    from public.activity_log al
    left join public.profiles pr on pr.id = al.user_id
    where al.org_id = p_org_id
    order by al.created_at desc
    limit greatest(coalesce(p_limit, 100), 1);
  else
    return query
    select
      al.id,
      al.org_id as workspace_id,
      al.user_id,
      coalesce(al.actor_name, pr.display_name, pr.email, 'Unknown') as user_name,
      al.action,
      coalesce(al.resource_type, 'workspace') as target_type,
      al.resource_name as target_name,
      coalesce(al.metadata, '{}'::jsonb) as metadata,
      al.created_at
    from public.activity_log al
    left join public.profiles pr on pr.id = al.user_id
    where al.org_id = p_org_id
      and al.user_id = v_user_id
    order by al.created_at desc
    limit greatest(coalesce(p_limit, 100), 1);
  end if;
end;
$$;

alter function public.get_workspace_activity(uuid, int) set row_security = off;
grant execute on function public.get_workspace_activity(uuid, int) to authenticated;

create or replace function public.create_workspace(p_name text)
returns table(
  org_id uuid,
  org_name text,
  org_slug text,
  role public.app_role
)
language plpgsql
security definer
set search_path = public
as $$
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

  v_base_slug := lower(btrim(p_name));
  v_base_slug := regexp_replace(v_base_slug, '[^a-z0-9]+', '-', 'g');
  v_base_slug := regexp_replace(v_base_slug, '(^-|-$)', '', 'g');
  v_base_slug := substring(v_base_slug, 1, 30);

  v_slug := v_base_slug;

  loop
    select count(*) into v_existing_count
    from public.orgs
    where slug = v_slug;

    exit when v_existing_count = 0;

    v_counter := v_counter + 1;
    v_slug := v_base_slug || '-' || v_counter;
  end loop;

  insert into public.orgs (name, slug, owner_id, created_by, plan)
  values (btrim(p_name), v_slug, v_user, v_user, 'free')
  returning id into v_org_id;

  insert into public.org_members (org_id, user_id, role)
  values (v_org_id, v_user, 'owner'::public.app_role);

  if to_regclass('public.user_preferences') is not null then
    insert into public.user_preferences (user_id, active_org_id)
    values (v_user, v_org_id)
    on conflict (user_id) do update
    set active_org_id = v_org_id, updated_at = now();
  end if;

  perform public.log_workspace_activity(
    v_org_id,
    'workspace_created',
    'workspace',
    btrim(p_name),
    jsonb_build_object(
      'workspace_id', v_org_id,
      'workspace_name', btrim(p_name),
      'workspace_slug', v_slug
    )
  );

  return query
  select v_org_id, btrim(p_name), v_slug, 'owner'::public.app_role;
end;
$$;

alter function public.create_workspace(text) set row_security = off;
