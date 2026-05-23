-- 009_ADD_NOTIFICATIONS.sql
-- Migration: Add in-app notification support for workspace invitations.
BEGIN;

CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_email text NOT NULL,
  org_id uuid REFERENCES public.orgs(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('workspace_invite','system','invite_accepted')),
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    recipient_id = auth.uid()
    OR lower(recipient_email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "notifications_insert" ON public.notifications;
CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    recipient_id = auth.uid()
    OR lower(recipient_email) = lower(auth.jwt() ->> 'email')
  );

DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
CREATE POLICY "notifications_update" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

DROP POLICY IF EXISTS "notifications_delete" ON public.notifications;
CREATE POLICY "notifications_delete" ON public.notifications
  FOR DELETE TO authenticated
  USING (recipient_id = auth.uid());

DROP FUNCTION IF EXISTS public.create_notification(text, uuid, uuid, text, jsonb);
CREATE OR REPLACE FUNCTION public.create_notification(
  _recipient_email text,
  _org_id uuid,
  _type text,
  _recipient_id uuid DEFAULT NULL,
  _payload jsonb DEFAULT '{}'
)
RETURNS public.notifications
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  notification_row public.notifications;
BEGIN
  IF _recipient_email IS NULL OR btrim(_recipient_email) = '' THEN
    RAISE EXCEPTION 'Recipient email is required for notification.';
  END IF;

  IF _org_id IS NULL THEN
    RAISE EXCEPTION 'Organization ID is required for notification.';
  END IF;

  IF _type IS NULL OR btrim(_type) = '' THEN
    RAISE EXCEPTION 'Notification type is required.';
  END IF;

  INSERT INTO public.notifications (recipient_id, recipient_email, org_id, type, payload)
  VALUES (
    _recipient_id,
    lower(trim(_recipient_email)),
    _org_id,
    _type,
    coalesce(_payload, '{}'::jsonb)
  )
  RETURNING * INTO notification_row;

  RETURN notification_row;
END;
$$;
ALTER FUNCTION public.create_notification(text, uuid, text, uuid, jsonb) SET row_security = off;

COMMIT;
