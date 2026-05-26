alter table public.collections
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.collections c
set created_by = coalesce(c.created_by, o.created_by)
from public.orgs o
where o.id = c.org_id
  and c.created_by is null;

create index if not exists collections_created_by_idx on public.collections(created_by);
create index if not exists org_members_org_user_role_idx on public.org_members(org_id, user_id, role);

drop policy if exists "collections_select" on public.collections;
drop policy if exists "collections_write" on public.collections;
drop policy if exists "collections_insert" on public.collections;
drop policy if exists "collections_update" on public.collections;
drop policy if exists "collections_delete" on public.collections;
drop policy if exists "collections_admin_select" on public.collections;

create policy "collections_select" on public.collections
  for select to authenticated
  using (
    exists (
      select 1
      from public.org_members om
      where om.org_id = collections.org_id
        and om.user_id = auth.uid()
    )
  );

create policy "collections_insert" on public.collections
  for insert to authenticated
  with check (
    auth.uid() is not null
    and collections.org_id is not null
    and collections.created_by = auth.uid()
    and exists (
      select 1
      from public.org_members om
      where om.org_id = collections.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

create policy "collections_update" on public.collections
  for update to authenticated
  using (
    exists (
      select 1
      from public.org_members om
      where om.org_id = collections.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1
      from public.org_members om
      where om.org_id = collections.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

create policy "collections_delete" on public.collections
  for delete to authenticated
  using (
    exists (
      select 1
      from public.org_members om
      where om.org_id = collections.org_id
        and om.user_id = auth.uid()
        and om.role in ('owner', 'admin')
    )
  );

grant select, insert, update, delete on public.collections to authenticated;
