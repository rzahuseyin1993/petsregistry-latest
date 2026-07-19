-- Dashboard RLS fixes:
-- 1. Members could never delete their own lost reports (UI has a Delete button, but only admins had DELETE).
-- 2. Members could not send themselves inbox reminders (PetHealth "Send to Inbox") — no INSERT policy.
-- 3. Members could not dismiss inbox messages — no DELETE policy, so "hide" was local-only and reappeared on refresh.

-- 1. Reporters can delete their own lost reports
DROP POLICY IF EXISTS "Reporters can delete own lost reports" ON public.lost_reports;
CREATE POLICY "Reporters can delete own lost reports" ON public.lost_reports
  FOR DELETE TO authenticated
  USING (auth.uid() = reporter_id);

-- 2. Users can send messages to themselves (self-reminders, e.g. vaccination reminders)
DROP POLICY IF EXISTS "Users can send messages to themselves" ON public.admin_messages;
CREATE POLICY "Users can send messages to themselves" ON public.admin_messages
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id AND auth.uid() = recipient_id);

-- 3. Recipients can delete (dismiss) messages from their own inbox
DROP POLICY IF EXISTS "Recipients can delete own messages" ON public.admin_messages;
CREATE POLICY "Recipients can delete own messages" ON public.admin_messages
  FOR DELETE TO authenticated
  USING (auth.uid() = recipient_id);
