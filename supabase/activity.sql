-- ============================================================
-- DashForge — Activity log (run AFTER schema.sql + admin.sql)
-- Idempotent.
-- ============================================================

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid references public.orgs(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  actor_email text,
  action text not null,        -- e.g. 'dashboard.created'
  target_type text,            -- e.g. 'dashboard'
  target_id uuid,
  target_label text,           -- human label, denormalised
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.activity_log enable row level security;
create index if not exists activity_org_idx on public.activity_log(org_id, created_at desc);

drop policy if exists "activity_select" on public.activity_log;
create policy "activity_select" on public.activity_log
  for select to authenticated
  using (
    (org_id is not null and public.is_org_member(org_id, auth.uid()))
    or public.is_platform_admin(auth.uid())
  );

drop policy if exists "activity_insert" on public.activity_log;
create policy "activity_insert" on public.activity_log
  for insert to authenticated
  with check (
    actor_id = auth.uid()
    and (org_id is null or public.is_org_member(org_id, auth.uid()))
  );
