-- Replace the default "admin@" contact email with a more professional support address.
-- Only touches rows still holding the original default, so custom values set by the admin are preserved.
UPDATE public.site_settings
SET value = 'support@petsregistry.org'
WHERE key = 'site_email'
  AND value = 'admin@petsregistry.org';

UPDATE public.site_settings
SET value = 'support@petsregistry.org'
WHERE key = 'support_email'
  AND value = 'admin@petsregistry.org';

UPDATE public.site_settings
SET value = 'notifications@petsregistry.org'
WHERE key = 'notification_email'
  AND value = 'admin@petsregistry.org';
