
-- Fix the overly permissive INSERT policy on notifications
-- Drop the old policy and create a more restrictive one
DROP POLICY "System can insert notifications" ON public.notifications;

-- Allow authenticated users to insert notifications (for edge functions and system use)
CREATE POLICY "Authenticated can insert notifications" ON public.notifications
  FOR INSERT TO authenticated WITH CHECK (true);
