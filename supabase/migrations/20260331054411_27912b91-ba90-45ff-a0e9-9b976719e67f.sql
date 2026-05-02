
-- Revoke direct SELECT on payment_settings base table from anon and authenticated roles
-- Force all reads through payment_settings_safe view (which excludes secret_key)
REVOKE SELECT ON public.payment_settings FROM anon, authenticated;

-- Also set security_invoker on payment_settings_safe so it respects RLS
ALTER VIEW public.payment_settings_safe SET (security_invoker = on);
