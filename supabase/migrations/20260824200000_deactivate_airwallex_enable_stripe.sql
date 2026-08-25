-- Deactivate Airwallex after YEPEE LLP Payments Services rejection.
-- Stripe becomes the primary card gateway; PayPal remains optional.

UPDATE public.payment_settings
SET is_active = false
WHERE provider IN ('airwallex', 'airwallex_demo', 'airwallex_prod');

-- Prefer Stripe active if credentials already exist (do not force-activate empty rows).
UPDATE public.payment_settings
SET is_active = true
WHERE provider = 'stripe'
  AND publishable_key IS NOT NULL
  AND length(trim(publishable_key)) > 5
  AND secret_key IS NOT NULL
  AND length(trim(secret_key)) > 10;
