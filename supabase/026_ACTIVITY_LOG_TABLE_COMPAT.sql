alter table public.activity_log
  add column if not exists org_id uuid,
  add column if not exists actor_name text,
  add column if not exists resource_type text,
  add column if not exists resource_name text,
  add column if not exists workspace_id uuid,
  add column if not exists user_name text,
  add column if not exists target_type text,
  add column if not exists target_name text;

update public.activity_log
set
  workspace_id = coalesce(workspace_id, org_id),
  user_name = coalesce(nullif(user_name, ''), nullif(actor_name, ''), 'Unknown'),
  target_type = coalesce(nullif(target_type, ''), nullif(resource_type, ''), 'workspace'),
  target_name = coalesce(nullif(target_name, ''), resource_name)
where workspace_id is null
   or user_name is null
   or target_type is null
   or (target_name is null and resource_name is not null);

create or replace function public.sync_activity_log_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.workspace_id := coalesce(new.workspace_id, new.org_id);
  new.org_id := coalesce(new.org_id, new.workspace_id);
  new.user_name := coalesce(nullif(new.user_name, ''), nullif(new.actor_name, ''), 'Unknown');
  new.actor_name := coalesce(nullif(new.actor_name, ''), new.user_name, 'Unknown');
  new.target_type := coalesce(nullif(new.target_type, ''), nullif(new.resource_type, ''), 'workspace');
  new.resource_type := coalesce(nullif(new.resource_type, ''), new.target_type, 'workspace');
  new.target_name := coalesce(nullif(new.target_name, ''), new.resource_name);
  new.resource_name := coalesce(nullif(new.resource_name, ''), new.target_name);
  new.metadata := coalesce(new.metadata, '{}'::jsonb);
  new.created_at := coalesce(new.created_at, now());
  return new;
end;
$$;

drop trigger if exists sync_activity_log_columns_trigger on public.activity_log;
create trigger sync_activity_log_columns_trigger
before insert or update on public.activity_log
for each row
execute function public.sync_activity_log_columns();

do $$
begin
  if not exists (
    select 1
    from public.activity_log
    where workspace_id is null
  ) then
    alter table public.activity_log
      alter column workspace_id set not null;
  end if;
end $$;

alter table public.activity_log
  alter column metadata set default '{}'::jsonb,
  alter column created_at set default now();

create index if not exists activity_log_workspace_idx on public.activity_log(workspace_id);
create index if not exists activity_log_workspace_created_at_idx on public.activity_log(workspace_id, created_at desc);

drop policy if exists "activity_log_select" on public.activity_log;
create policy "activity_log_select" on public.activity_log
  for select to authenticated
  using (
    workspace_id is not null
    and public.has_org_role(workspace_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

drop policy if exists "activity_log_insert" on public.activity_log;
create policy "activity_log_insert" on public.activity_log
  for insert to authenticated
  with check (
    workspace_id is not null
    and user_id = auth.uid()
    and public.is_org_member(workspace_id, auth.uid())
  );

grant select, insert on public.activity_log to authenticated;
