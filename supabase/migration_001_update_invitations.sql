-- Recreate invitation functions and ensure schema correctness
BEGIN;

-- 1) Ensure indexes/unique constraints exist for fast lookups and conflict targets
CREATE INDEX IF NOT EXISTS invitations_token_idx ON public.invitations (token);
CREATE UNIQUE INDEX IF NOT EXISTS org_members_org_user_uidx ON public.org_members (org_id, user_id);

-- Ensure dashboard_permissions table exists (create minimal compatible table if missing).
-- This avoids migration failures when the table has not been created by earlier migrations.
CREATE TABLE IF NOT EXISTS public.dashboard_permissions (
  dashboard_id uuid NOT NULL,
  user_id uuid NOT NULL,
  org_id uuid,
  role text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS dashboard_permissions_dashboard_user_uidx ON public.dashboard_permissions (dashboard_id, user_id);

-- 2) Ensure invitations.dashboard_ids is uuid[]; attempt common safe conversions
DO $$
DECLARE
  col_type text;
BEGIN
  SELECT udt_name INTO col_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'dashboard_ids';

  IF col_type IS NULL THEN
    RAISE NOTICE 'Column public.invitations.dashboard_ids does not exist; skipping conversion';
    RETURN;
  END IF;

  IF col_type = 'uuid[]' THEN
    RAISE NOTICE 'public.invitations.dashboard_ids already uuid[]';
    RETURN;
  END IF;

  IF col_type IN ('jsonb','json') THEN
    RAISE NOTICE 'Converting public.invitations.dashboard_ids from % to uuid[]', col_type;
    EXECUTE 'ALTER TABLE public.invitations ALTER COLUMN dashboard_ids TYPE uuid[] USING (SELECT array_agg(x::uuid) FROM jsonb_array_elements_text(dashboard_ids::jsonb) AS t(x))';
    RETURN;
  END IF;

  IF col_type = 'text' THEN
    RAISE NOTICE 'Converting public.invitations.dashboard_ids from text to uuid[] (comma-separated)';
    EXECUTE 'ALTER TABLE public.invitations ALTER COLUMN dashboard_ids TYPE uuid[] USING (string_to_array(dashboard_ids, '','')::uuid[])';
    RETURN;
  END IF;

  IF col_type = 'text[]' THEN
    RAISE NOTICE 'Converting public.invitations.dashboard_ids from text[] to uuid[]';
    EXECUTE 'ALTER TABLE public.invitations ALTER COLUMN dashboard_ids TYPE uuid[] USING (dashboard_ids::uuid[])';
    RETURN;
  END IF;

  RAISE NOTICE 'public.invitations.dashboard_ids has unsupported type %; manual migration may be required', col_type;
END
$$ LANGUAGE plpgsql;

-- 3) Drop old accept_invitation (if any) and recreate a clean, unambiguous implementation
DROP FUNCTION IF EXISTS public.accept_invitation(text) CASCADE;

CREATE OR REPLACE FUNCTION public.accept_invitation(p_token text)
RETURNS TABLE(org_id uuid, user_id uuid, role public.app_role)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $func$
DECLARE
  v_invite public.invitations%rowtype;
  v_user_id uuid := auth.uid();
  v_user_email text := (auth.jwt() ->> 'email');
  v_accepted_role public.app_role := 'member';
  v_ret_org_id uuid;
  v_ret_user_id uuid;
  v_ret_role public.app_role;
  v_dashboard_id uuid;
BEGIN
  -- Validate input
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invitation token is required';
  END IF;

  -- Fetch the invitation explicitly (alias i)
  SELECT i.* INTO v_invite
  FROM public.invitations AS i
  WHERE i.token = p_token
  LIMIT 1;

  IF NOT FOUND OR v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  -- Must be pending
  IF v_invite.status IS NULL OR lower(v_invite.status) <> 'pending' THEN
    RAISE EXCEPTION 'Invitation already accepted or not pending.';
  END IF;

  -- Caller must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required to accept invitation.';
  END IF;

  -- Ensure jwt email matches invitation email
  IF v_user_email IS NULL OR lower(v_user_email) <> lower(v_invite.email) THEN
    RAISE EXCEPTION 'Please sign in with % to accept this invitation.', v_invite.email;
  END IF;

  -- Decide accepted role preserving owner/admin semantics
  IF v_invite.role = 'admin' THEN
    v_accepted_role := 'admin';
  END IF;

  -- Insert membership with explicit columns and unambiguous conflict handling
  INSERT INTO public.org_members (org_id, user_id, role)
  VALUES (v_invite.org_id, v_user_id, v_accepted_role)
  ON CONFLICT (org_id, user_id) DO UPDATE
    SET role = CASE
      WHEN public.org_members.role = 'owner' THEN 'owner'
      WHEN EXCLUDED.role = 'admin' THEN 'admin'
      ELSE public.org_members.role
    END
  RETURNING org_id, user_id, role
  INTO v_ret_org_id, v_ret_user_id, v_ret_role;

  -- Grant dashboard permissions when dashboards belong to that org
  IF v_invite.dashboard_ids IS NOT NULL AND array_length(v_invite.dashboard_ids, 1) > 0 THEN
    FOREACH v_dashboard_id IN ARRAY v_invite.dashboard_ids LOOP
      PERFORM 1 FROM public.dashboards AS d
      WHERE d.id = v_dashboard_id
        AND d.org_id = v_invite.org_id;
      IF FOUND THEN
        INSERT INTO public.dashboard_permissions (dashboard_id, user_id, org_id, role)
        VALUES (v_dashboard_id, v_user_id, v_invite.org_id, v_invite.role)
        ON CONFLICT (dashboard_id, user_id) DO UPDATE
          SET role = EXCLUDED.role;
      END IF;
    END LOOP;
  END IF;

  -- Remove the invitation (use explicit alias and id)
  DELETE FROM public.invitations AS i
  WHERE i.id = v_invite.id;

  -- Notify PostgREST to reload schema cache
  PERFORM pg_notify('pgrst', 'reload schema');

  -- Return the membership info
  RETURN QUERY SELECT v_ret_org_id, v_ret_user_id, v_ret_role;
END;
$func$;

-- 4) Set function owner and permissions
-- Adjust owner if your deployment uses a different DB owner role.
ALTER FUNCTION public.accept_invitation(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text) TO authenticated;

-- 5) Final notify to ensure clients reload schema cache
SELECT pg_notify('pgrst','reload schema');

COMMIT;
