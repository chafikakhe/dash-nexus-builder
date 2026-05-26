alter table public.collections
  add column if not exists created_by uuid references auth.users(id) on delete set null;

update public.collections c
set created_by = o.created_by
from public.orgs o
where c.org_id = o.id
  and c.created_by is null;

create index if not exists collections_created_by_idx on public.collections(created_by);

drop policy if exists "collections_insert" on public.collections;
create policy "collections_insert" on public.collections
  for insert to authenticated
  with check (
    auth.uid() is not null
    and org_id is not null
    and created_by = auth.uid()
    and public.is_org_member(org_id, auth.uid())
    and public.has_org_role(org_id, auth.uid(), array['owner','admin','editor']::public.app_role[])
  );
