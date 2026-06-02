INSERT INTO public.site_settings (key, value, description)
VALUES (
  'maintenance_mode',
  'false',
  'When true, the public site shows the maintenance page. Overrides VITE_MAINTENANCE_MODE when set.'
)
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  description = EXCLUDED.description;
