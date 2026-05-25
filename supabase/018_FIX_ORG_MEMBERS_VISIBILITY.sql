-- Fix Members page visibility: any member of an org can read all accepted
-- org_members rows for that org, without recursive RLS.

create or replace function public.is_org_member(p_org uuid, p_user uuid)
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
  );
$$;

create or replace function public.has_org_role(p_org uuid, p_user uuid, p_roles public.app_role[])
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
      and om.role = any(p_roles)
  );
$$;

grant execute on function public.is_org_member(uuid, uuid) to authenticated;
grant execute on function public.has_org_role(uuid, uuid, public.app_role[]) to authenticated;

alter table public.org_members enable row level security;

drop policy if exists "members_select" on public.org_members;
drop policy if exists "members_admin_select" on public.org_members;
drop policy if exists "org_members_select" on public.org_members;

create policy "org_members_select" on public.org_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or public.is_org_member(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create index if not exists org_members_org_user_idx on public.org_members(org_id, user_id);
create index if not exists org_members_user_idx on public.org_members(user_id);

-- Keep pending invitations separate from accepted members.
-- This RPC is used by the Members page and returns pending invites only.
create or replace function public.get_org_invitations(p_org_id uuid)
returns table(
  id uuid,
  email text,
  role public.app_role,
  status text,
  created_at timestamptz,
  invited_by uuid,
  inviter_email text,
  inviter_display_name text,
  token text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.email,
    i.role,
    i.status,
    i.created_at,
    i.invited_by,
    au.email as inviter_email,
    coalesce(pr.display_name, au.email, 'Unknown') as inviter_display_name,
    i.token
  from public.invitations i
  left join auth.users au on au.id = i.invited_by
  left join public.profiles pr on pr.id = i.invited_by
  where i.org_id = p_org_id
    and i.status = 'pending'
    and (
      public.is_org_member(i.org_id, auth.uid())
      or public.is_platform_admin(auth.uid())
    )
  order by i.created_at desc;
$$;

grant execute on function public.get_org_invitations(uuid) to authenticated;

notify pgrst, 'reload schema';
