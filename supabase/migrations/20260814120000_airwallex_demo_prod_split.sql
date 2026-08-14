-- Split Airwallex into separate demo and production credential rows.
ALTER TABLE public.payment_settings DROP CONSTRAINT IF EXISTS payment_settings_provider_check;
ALTER TABLE public.payment_settings ADD CONSTRAINT payment_settings_provider_check
  CHECK (provider IN ('stripe', 'paypal', 'airwallex', 'airwallex_demo', 'airwallex_prod'));

INSERT INTO public.payment_settings (provider, is_active, publishable_key, secret_key)
SELECT 'airwallex_demo', false, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE provider = 'airwallex_demo');

INSERT INTO public.payment_settings (provider, is_active, publishable_key, secret_key)
SELECT 'airwallex_prod', false, NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.payment_settings WHERE provider = 'airwallex_prod');

-- Migrate legacy single airwallex row into demo or prod based on airwallex_environment.
DO $$
DECLARE
  legacy record;
  target_provider text;
  env_value text;
BEGIN
  SELECT value INTO env_value FROM public.site_settings WHERE key = 'airwallex_environment';
  target_provider := CASE WHEN lower(coalesce(env_value, 'demo')) = 'prod' THEN 'airwallex_prod' ELSE 'airwallex_demo' END;

  SELECT * INTO legacy FROM public.payment_settings WHERE provider = 'airwallex' LIMIT 1;
  IF legacy IS NOT NULL AND (legacy.publishable_key IS NOT NULL OR legacy.secret_key IS NOT NULL OR legacy.is_active) THEN
    UPDATE public.payment_settings
    SET
      publishable_key = coalesce(legacy.publishable_key, publishable_key),
      secret_key = coalesce(legacy.secret_key, secret_key),
      is_active = legacy.is_active
    WHERE provider = target_provider;
  END IF;
END $$;

INSERT INTO public.site_settings (key, value, description)
VALUES ('airwallex_checkout_mode', 'demo', 'Which Airwallex credentials checkout uses: demo or prod')
ON CONFLICT (key) DO NOTHING;

UPDATE public.site_settings
SET value = lower(trim(value))
WHERE key = 'airwallex_checkout_mode'
  AND lower(trim(value)) NOT IN ('demo', 'prod');

-- Copy legacy environment into checkout mode when checkout mode was never set explicitly.
UPDATE public.site_settings checkout
SET value = lower(trim(env.value))
FROM public.site_settings env
WHERE checkout.key = 'airwallex_checkout_mode'
  AND env.key = 'airwallex_environment'
  AND checkout.value = 'demo'
  AND lower(trim(env.value)) IN ('demo', 'prod');

INSERT INTO public.site_settings (key, value, description)
VALUES
  ('airwallex_demo_account_id', '', 'Airwallex sandbox x-login-as account ID (optional)'),
  ('airwallex_prod_account_id', '', 'Airwallex live x-login-as account ID (optional)')
ON CONFLICT (key) DO NOTHING;

-- Legacy single account id applies to whichever side was active.
UPDATE public.site_settings demo
SET value = legacy.value
FROM public.site_settings legacy
WHERE demo.key = 'airwallex_demo_account_id'
  AND legacy.key = 'airwallex_account_id'
  AND coalesce(demo.value, '') = ''
  AND coalesce(legacy.value, '') <> ''
  AND coalesce((SELECT value FROM public.site_settings WHERE key = 'airwallex_checkout_mode'), 'demo') = 'demo';

UPDATE public.site_settings prod
SET value = legacy.value
FROM public.site_settings legacy
WHERE prod.key = 'airwallex_prod_account_id'
  AND legacy.key = 'airwallex_account_id'
  AND coalesce(prod.value, '') = ''
  AND coalesce(legacy.value, '') <> ''
  AND coalesce((SELECT value FROM public.site_settings WHERE key = 'airwallex_checkout_mode'), 'demo') = 'prod';
