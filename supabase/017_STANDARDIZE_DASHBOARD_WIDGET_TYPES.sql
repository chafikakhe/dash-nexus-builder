-- Standardize dashboard widget types across database, AI generation, and frontend.
-- Canonical values:
--   stat, bar_chart, line_chart, pie_chart, table

create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  type text not null,
  title text not null,
  config jsonb not null default '{}'::jsonb,
  width integer not null default 4,
  height integer not null default 3,
  x integer not null default 0,
  y integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_widgets
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists dashboard_id uuid references public.dashboards(id) on delete cascade,
  add column if not exists org_id uuid references public.orgs(id) on delete cascade,
  add column if not exists type text,
  add column if not exists title text,
  add column if not exists config jsonb default '{}'::jsonb,
  add column if not exists width integer default 4,
  add column if not exists height integer default 3,
  add column if not exists x integer default 0,
  add column if not exists y integer default 0,
  add column if not exists created_by uuid references auth.users(id) on delete set null,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

-- Convert existing rows before tightening the check constraint.
update public.dashboard_widgets
set type = case type
  when 'bar' then 'bar_chart'
  when 'line' then 'line_chart'
  when 'pie' then 'pie_chart'
  else type
end
where type in ('bar', 'line', 'pie');

-- Keep legacy dashboard layout JSON safe for dashboards saved before this change.
update public.dashboards
set layout = (
  select jsonb_agg(
    case widget->>'type'
      when 'bar' then jsonb_set(widget, '{type}', '"bar_chart"'::jsonb)
      when 'line' then jsonb_set(widget, '{type}', '"line_chart"'::jsonb)
      when 'pie' then jsonb_set(widget, '{type}', '"pie_chart"'::jsonb)
      else widget
    end
    order by ordinality
  )
  from jsonb_array_elements(layout::jsonb) with ordinality as widgets(widget, ordinality)
)
where jsonb_typeof(layout::jsonb) = 'array'
  and exists (
    select 1
    from jsonb_array_elements(layout::jsonb) as widgets(widget)
    where widget->>'type' in ('bar', 'line', 'pie')
  );

-- Drop previous type check constraints regardless of their generated names.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'dashboard_widgets'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%type%'
  loop
    execute format('alter table public.dashboard_widgets drop constraint if exists %I', constraint_name);
  end loop;
end $$;

alter table public.dashboard_widgets
  add constraint dashboard_widgets_type_check
  check (type in ('stat', 'bar_chart', 'line_chart', 'pie_chart', 'table'));

alter table public.dashboard_widgets
  drop constraint if exists dashboard_widgets_width_check,
  add constraint dashboard_widgets_width_check check (width between 2 and 12),
  drop constraint if exists dashboard_widgets_height_check,
  add constraint dashboard_widgets_height_check check (height between 2 and 8),
  drop constraint if exists dashboard_widgets_x_check,
  add constraint dashboard_widgets_x_check check (x between 0 and 11),
  drop constraint if exists dashboard_widgets_y_check,
  add constraint dashboard_widgets_y_check check (y >= 0);

alter table public.dashboard_widgets enable row level security;

create index if not exists dashboard_widgets_dashboard_idx on public.dashboard_widgets(dashboard_id);
create index if not exists dashboard_widgets_org_idx on public.dashboard_widgets(org_id);

-- Verify helper functions used by RLS policies exist.
do $$
begin
  if to_regprocedure('public.is_org_member(uuid, uuid)') is null then
    raise exception 'Missing required helper function public.is_org_member(uuid, uuid)';
  end if;

  if to_regprocedure('public.has_org_role(uuid, uuid, public.app_role[])') is null then
    raise exception 'Missing required helper function public.has_org_role(uuid, uuid, public.app_role[])';
  end if;

  if to_regprocedure('public.is_platform_admin(uuid)') is null then
    raise exception 'Missing required helper function public.is_platform_admin(uuid)';
  end if;
end $$;

drop policy if exists "dashboard_widgets_select" on public.dashboard_widgets;
create policy "dashboard_widgets_select" on public.dashboard_widgets
  for select to authenticated
  using (
    public.is_org_member(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "dashboard_widgets_write" on public.dashboard_widgets;
create policy "dashboard_widgets_write" on public.dashboard_widgets
  for all to authenticated
  using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
    or public.is_platform_admin(auth.uid())
  );

-- Column verification for the expected production shape.
do $$
declare
  missing_columns text[];
begin
  select array_agg(expected.column_name)
  into missing_columns
  from (
    values
      ('id'),
      ('dashboard_id'),
      ('org_id'),
      ('type'),
      ('title'),
      ('config'),
      ('width'),
      ('height'),
      ('x'),
      ('y'),
      ('created_by'),
      ('created_at'),
      ('updated_at')
  ) as expected(column_name)
  where not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dashboard_widgets'
      and column_name = expected.column_name
  );

  if missing_columns is not null then
    raise exception 'dashboard_widgets is missing expected columns: %', array_to_string(missing_columns, ', ');
  end if;
end $$;

notify pgrst, 'reload schema';
