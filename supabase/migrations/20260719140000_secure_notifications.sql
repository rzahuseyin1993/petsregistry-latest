-- Harden insert_system_notification against anonymous abuse.
-- Previously any caller (including anon) could insert notifications for ANY user_id,
-- allowing notification spam / inbox flooding. Now the function only runs for:
--   * the service role (trusted server-side edge functions), or
--   * an authenticated user (cross-user notifications still require a real account,
--     and the sensitive anonymous "contact owner" flows now go through the
--     owner-messaging edge function which runs as the service role).
CREATE OR REPLACE FUNCTION public.insert_system_notification(
  _user_id uuid,
  _title text,
  _message text,
  _type text DEFAULT 'info',
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' AND auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authorized to create notifications';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (_user_id, _title, _message, _type, _link, _metadata);
END;
$$;

-- Only the service role and authenticated users may execute it; revoke anon.
REVOKE EXECUTE ON FUNCTION public.insert_system_notification(uuid, text, text, text, text, jsonb) FROM anon;
