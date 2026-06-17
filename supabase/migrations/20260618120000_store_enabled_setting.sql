INSERT INTO public.site_settings (key, value, description)
VALUES (
  'store_enabled',
  'true',
  'When false, the public Store page and navigation links are hidden.'
)
ON CONFLICT (key) DO UPDATE SET
  description = EXCLUDED.description;
