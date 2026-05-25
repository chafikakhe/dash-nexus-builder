create table if not exists public.dashboard_widgets (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  type text not null check (type in ('stat', 'bar_chart', 'line_chart', 'pie_chart', 'table')),
  title text not null,
  config jsonb not null default '{}'::jsonb,
  width integer not null check (width between 2 and 12),
  height integer not null check (height between 2 and 8),
  x integer not null default 0 check (x between 0 and 11),
  y integer not null default 0 check (y >= 0),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.dashboard_widgets enable row level security;

create index if not exists dashboard_widgets_dashboard_idx on public.dashboard_widgets(dashboard_id);
create index if not exists dashboard_widgets_org_idx on public.dashboard_widgets(org_id);

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

notify pgrst, 'reload schema';
