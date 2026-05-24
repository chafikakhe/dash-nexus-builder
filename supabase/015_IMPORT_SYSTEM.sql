-- ==============================================
-- Import System Database Migration
-- ==============================================
-- This migration creates tables for tracking imports
-- Run this against your Supabase database

-- ============================================================
-- 1. CREATE IMPORTS TABLE
-- ============================================================

create table if not exists public.imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  org_id uuid not null references public.orgs(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  filename text not null,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  errors jsonb default '[]'::jsonb,
  warnings jsonb default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'success', 'partial', 'failed')),
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.imports enable row level security;

-- Create indexes for performance
create index if not exists imports_org_idx on public.imports(org_id);
create index if not exists imports_collection_idx on public.imports(collection_id);
create index if not exists imports_user_idx on public.imports(user_id);
create index if not exists imports_created_at_idx on public.imports(created_at desc);
create index if not exists imports_status_idx on public.imports(status);

-- ============================================================
-- 2. ROW LEVEL SECURITY POLICIES FOR IMPORTS
-- ============================================================

-- SELECT: Users can view imports from their organization
drop policy if exists "imports_select" on public.imports;
create policy "imports_select" on public.imports
  for select to authenticated
  using (
    public.is_org_member(org_id, auth.uid())
    or
    public.is_platform_admin(auth.uid())
  );

-- INSERT: Only editors and admins can create imports
drop policy if exists "imports_insert" on public.imports;
create policy "imports_insert" on public.imports
  for insert to authenticated
  with check (
    public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );

-- UPDATE: Only system or import owner can update
drop policy if exists "imports_update" on public.imports;
create policy "imports_update" on public.imports
  for update to authenticated
  using (
    user_id = auth.uid()
    or
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  )
  with check (
    user_id = auth.uid()
    or
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- DELETE: Only admins can delete imports
drop policy if exists "imports_delete" on public.imports;
create policy "imports_delete" on public.imports
  for delete to authenticated
  using (
    public.has_org_role(org_id, auth.uid(), array['owner','admin']::public.app_role[])
  );

-- ============================================================
-- 3. HELPER FUNCTIONS
-- ============================================================

-- Get import statistics for an organization
create or replace function public.get_import_statistics(p_org_id uuid)
returns table(
  total_imports bigint,
  total_records_imported bigint,
  successful_imports bigint,
  failed_imports bigint,
  average_rows_per_import numeric
) as $$
begin
  return query
  select
    count(*),
    coalesce(sum(imported_rows), 0),
    count(*) filter (where status = 'success'),
    count(*) filter (where status = 'failed'),
    case 
      when count(*) > 0 then round(sum(imported_rows)::numeric / count(*), 2)
      else 0
    end
  from public.imports
  where org_id = p_org_id;
end;
$$ language plpgsql security definer;

-- Get recent imports for a collection
create or replace function public.get_collection_imports(p_collection_id uuid, p_limit int default 50)
returns table(
  id uuid,
  filename text,
  imported_rows integer,
  failed_rows integer,
  status text,
  created_at timestamptz
) as $$
begin
  return query
  select
    imports.id,
    imports.filename,
    imports.imported_rows,
    imports.failed_rows,
    imports.status,
    imports.created_at
  from public.imports
  where collection_id = p_collection_id
  order by created_at desc
  limit p_limit;
end;
$$ language plpgsql security definer;

-- ============================================================
-- 4. TRIGGERS FOR AUDIT
-- ============================================================

-- Auto-update updated_at on imports
create or replace function public.update_imports_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists imports_updated_at on public.imports;
create trigger imports_updated_at
  before update on public.imports
  for each row
  execute function update_imports_updated_at();

-- ============================================================
-- 5. GRANTS
-- ============================================================

-- Grant execute permissions on helper functions
grant execute on function public.get_import_statistics(uuid) to authenticated;
grant execute on function public.get_collection_imports(uuid, int) to authenticated;

-- Grant select on imports table to authenticated users
grant select on public.imports to authenticated;
grant insert on public.imports to authenticated;
grant update on public.imports to authenticated;
grant delete on public.imports to authenticated;

-- ============================================================
-- 6. VERIFICATION
-- ============================================================

-- Verify migration was successful
select table_name from information_schema.tables 
where table_name = 'imports' and table_schema = 'public';

-- Check policies
select * from pg_policies where tablename = 'imports';

-- ============================================================
-- 7. OPTIONAL: ADD TO ACTIVITY LOG
-- ============================================================

-- Insert import events into activity log (if activity_log table exists)
-- This is optional and depends on your setup

create or replace function public.log_import()
returns trigger as $$
begin
  if new.status = 'success' or new.status = 'partial' then
    insert into public.activity_log (org_id, user_id, action, metadata, created_at)
    values (
      new.org_id,
      new.user_id,
      'import_completed',
      jsonb_build_object(
        'import_id', new.id,
        'filename', new.filename,
        'rows_imported', new.imported_rows,
        'rows_failed', new.failed_rows
      ),
      now()
    );
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists log_import_trigger on public.imports;
create trigger log_import_trigger
  after insert on public.imports
  for each row
  when (new.status in ('success', 'partial', 'failed'))
  execute function log_import();
