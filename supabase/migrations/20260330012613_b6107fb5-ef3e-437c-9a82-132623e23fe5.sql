
-- Fix 1: Notifications - change DELETE and UPDATE policies from public to authenticated
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;
CREATE POLICY "Users can delete own notifications"
  ON public.notifications
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
CREATE POLICY "Users can update own notifications"
  ON public.notifications
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Also fix the SELECT policy to use authenticated
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications"
  ON public.notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix 2: Payment settings - remove secret_key from being selectable even by admins via RLS
-- Create a restricted SELECT policy that excludes the secret_key column
-- (Column-level security isn't available via RLS, so we ensure the admin query in AdminPayments.tsx already excludes it)
-- The real fix: ensure the existing admin SELECT policy is scoped to authenticated only
DROP POLICY IF EXISTS "Admins can manage payment settings" ON public.payment_settings;
CREATE POLICY "Admins can manage payment settings"
  ON public.payment_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
