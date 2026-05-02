-- Create a SECURITY DEFINER function for inserting notifications to other users
-- Used by admin broadcasts, lost-pet alerts, and system notifications
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
  INSERT INTO public.notifications (user_id, title, message, type, link, metadata)
  VALUES (_user_id, _title, _message, _type, _link, _metadata);
END;
$$;

-- Tighten the INSERT policy: users can only insert notifications for themselves
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON notifications;
CREATE POLICY "Users can insert own notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);
