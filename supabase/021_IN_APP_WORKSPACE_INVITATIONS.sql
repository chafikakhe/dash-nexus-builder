-- In-app workspace invitations.
--
-- This keeps the existing public.accept_invitation(text) flow intact.
-- It adds safe read access for invited users by email and a decline RPC.

alter table public.invitations
  add column if not exists token text not null default encode(gen_random_bytes(24), 'hex'),
  add column if not exists status text not null default 'pending',
  add column if not exists expires_at timestamptz not null default (now() + interval '7 days'),
  add column if not exists accepted_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists dashboard_permissions jsonb not null default '[]'::jsonb,
  add column if not exists collection_permissions jsonb not null default '[]'::jsonb;

alter table public.invitations
  drop constraint if exists invitations_status_check,
  add constraint invitations_status_check check (status in ('pending','accepted','declined','expired'));

create unique index if not exists invitations_token_uidx on public.invitations(token);
create index if not exists invitations_email_status_expires_idx
  on public.invitations(lower(email), status, expires_at);
create index if not exists invitations_org_status_idx
  on public.invitations(org_id, status);

alter table public.invitations enable row level security;

drop policy if exists "invitations_select" on public.invitations;
drop policy if exists "invitations_insert" on public.invitations;
drop policy if exists "invitations_update" on public.invitations;
drop policy if exists "invitations_delete" on public.invitations;
drop policy if exists "Invited users can read own pending invitations" on public.invitations;
drop policy if exists "Workspace managers can read invitations" on public.invitations;

create policy "invitations_select" on public.invitations
  for select to authenticated
  using (
    (
      lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and status = 'pending'
      and expires_at > now()
    )
    or public.can_manage_org(org_id, auth.uid())
    or invited_by = auth.uid()
    or public.is_platform_admin(auth.uid())
  );

create policy "invitations_insert" on public.invitations
  for insert to authenticated
  with check (
    public.can_manage_org(org_id, auth.uid())
    or exists (
      select 1
      from public.org_members om
      where om.org_id = public.invitations.org_id
        and om.user_id = auth.uid()
        and om.role = 'admin'
    )
    or public.is_platform_admin(auth.uid())
  );

create policy "invitations_update" on public.invitations
  for update to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  )
  with check (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

create policy "invitations_delete" on public.invitations
  for delete to authenticated
  using (
    public.can_manage_org(org_id, auth.uid())
    or public.is_platform_admin(auth.uid())
  );

drop function if exists public.reject_invitation(text);
drop function if exists public.decline_invitation(text);

create or replace function public.decline_invitation(p_token text)
returns table(invitation_id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_user uuid := auth.uid();
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if p_token is null or btrim(p_token) = '' then
    raise exception 'Invitation token is required.';
  end if;

  if v_user is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_invitation
  from public.invitations i
  where i.token = p_token
  limit 1;

  if not found or v_invitation.id is null then
    raise exception 'Invitation not found.';
  end if;

  if lower(v_invitation.email) <> v_email then
    raise exception 'Please sign in with the invited email to decline this invitation.';
  end if;

  if v_invitation.status <> 'pending' then
    raise exception 'Invitation is no longer pending.';
  end if;

  if v_invitation.expires_at <= now() then
    update public.invitations
    set status = 'expired', updated_at = now()
    where id = v_invitation.id;
    raise exception 'Invitation has expired.';
  end if;

  update public.invitations
  set status = 'declined', updated_at = now()
  where id = v_invitation.id;

  return query select v_invitation.id, 'declined'::text;
end;
$$;

grant execute on function public.decline_invitation(text) to authenticated;

create or replace function public.create_invitation(
  p_email text,
  p_org_id uuid,
  p_role public.app_role default 'member'::public.app_role,
  p_dashboard_permissions jsonb default '[]'::jsonb,
  p_collection_permissions jsonb default '[]'::jsonb
)
returns public.invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.invitations%rowtype;
  v_sender uuid := auth.uid();
begin
  if v_sender is null then
    raise exception 'Authentication required to create invitation.';
  end if;

  if p_role not in ('admin'::public.app_role, 'member'::public.app_role) then
    raise exception 'Invitations can only assign admin or member roles.';
  end if;

  if not (
    public.can_manage_org(p_org_id, v_sender)
    or exists (
      select 1
      from public.org_members om
      where om.org_id = p_org_id
        and om.user_id = v_sender
        and om.role = 'admin'
    )
  ) then
    raise exception 'Only workspace owners and admins can send invitations.';
  end if;

  if jsonb_array_length(coalesce(p_dashboard_permissions, '[]'::jsonb)) = 0
    and jsonb_array_length(coalesce(p_collection_permissions, '[]'::jsonb)) = 0 then
    raise exception 'Select at least one dashboard or collection to share.';
  end if;

  delete from public.invitations
  where org_id = p_org_id
    and lower(email) = lower(trim(p_email))
    and status = 'pending';

  insert into public.invitations (
    email,
    org_id,
    role,
    invited_by,
    dashboard_ids,
    collection_ids,
    dashboard_permissions,
    collection_permissions,
    status
  )
  values (
    lower(trim(p_email)),
    p_org_id,
    p_role,
    v_sender,
    array(select (item->>'dashboard_id')::uuid from jsonb_array_elements(coalesce(p_dashboard_permissions, '[]'::jsonb)) as item),
    array(select (item->>'collection_id')::uuid from jsonb_array_elements(coalesce(p_collection_permissions, '[]'::jsonb)) as item),
    coalesce(p_dashboard_permissions, '[]'::jsonb),
    coalesce(p_collection_permissions, '[]'::jsonb),
    'pending'
  )
  returning * into v_invitation;

  return v_invitation;
end;
$$;

grant execute on function public.create_invitation(text, uuid, public.app_role, jsonb, jsonb) to authenticated;

-- Compatibility wrapper for older frontend code that still calls reject_invitation.
create or replace function public.reject_invitation(p_token text)
returns table(invitation_id uuid, status text)
language sql
security definer
set search_path = public
as $$
  select * from public.decline_invitation(p_token);
$$;

grant execute on function public.reject_invitation(text) to authenticated;

notify pgrst, 'reload schema';
