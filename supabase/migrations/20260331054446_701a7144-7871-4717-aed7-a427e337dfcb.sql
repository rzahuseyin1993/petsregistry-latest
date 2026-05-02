
-- Revert security_invoker on payment_settings_safe
-- The view is safe (excludes secret_key) and needs to bypass base table privileges
ALTER VIEW public.payment_settings_safe SET (security_invoker = off);
