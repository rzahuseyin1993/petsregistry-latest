-- Donate / membership pages must show active gateways to all visitors (not only admins).
-- payment_settings_safe uses security_invoker, so base-table RLS applies to the view.

GRANT SELECT ON public.payment_settings_safe TO anon, authenticated;

DROP POLICY IF EXISTS "Public can view active payment gateways" ON public.payment_settings;
CREATE POLICY "Public can view active payment gateways"
  ON public.payment_settings
  FOR SELECT
  TO anon, authenticated
  USING (is_active = true);
