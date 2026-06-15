-- Add Airwallex as a payment provider; disable Stripe (keep row for future use).
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS payment_settings_provider_check;
ALTER TABLE public.payment_settings ADD CONSTRAINT payment_settings_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'airwallex'));

INSERT INTO public.payment_settings (provider, is_active, publishable_key, secret_key)
SELECT 'airwallex', false, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE provider = 'airwallex');

UPDATE public.payment_settings SET is_active = false WHERE provider = 'stripe';

INSERT INTO public.site_settings (key, value, description)
VALUES ('airwallex_environment', 'demo', 'Airwallex API environment: demo or prod')
ON CONFLICT (key) DO NOTHING;
