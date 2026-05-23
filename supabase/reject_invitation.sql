-- Idempotent reject_invitation function for invitation lifecycle.
BEGIN;

DROP FUNCTION IF EXISTS public.reject_invitation(text) CASCADE;

CREATE OR REPLACE FUNCTION public.reject_invitation(p_token text)
RETURNS TABLE(invitation_id uuid, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invitations%rowtype;
BEGIN
  IF p_token IS NULL OR btrim(p_token) = '' THEN
    RAISE EXCEPTION 'Invitation token is required.';
  END IF;

  SELECT i.* INTO v_inv
  FROM public.invitations AS i
  WHERE i.token = p_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found.';
  END IF;

  IF v_inv.status IS NOT NULL AND lower(v_inv.status) <> 'pending' THEN
    RETURN QUERY SELECT v_inv.id, lower(v_inv.status);
    RETURN;
  END IF;

  UPDATE public.invitations AS i
  SET status = 'rejected'
  WHERE i.id = v_inv.id;

  PERFORM pg_notify('pgrst', 'reload schema');

  RETURN QUERY SELECT v_inv.id, 'rejected';
END;
$$;

ALTER FUNCTION public.reject_invitation(text) OWNER TO postgres;
GRANT EXECUTE ON FUNCTION public.reject_invitation(text) TO authenticated;

COMMIT;
