
-- Drop the overly permissive SELECT policy for authenticated users
DROP POLICY IF EXISTS "Authenticated can view site settings" ON public.site_settings;

-- Create a new SELECT policy that excludes sensitive keys for non-admin users
CREATE POLICY "Authenticated can view non-sensitive settings"
ON public.site_settings
FOR SELECT
TO authenticated
USING (
  key NOT LIKE 'smtp_%' AND key NOT LIKE 'vapid_%'
);

-- Also allow public (unauthenticated) to read non-sensitive settings like mobile_site_enabled
CREATE POLICY "Public can view non-sensitive settings"
ON public.site_settings
FOR SELECT
TO public
USING (
  key NOT LIKE 'smtp_%' AND key NOT LIKE 'vapid_%'
  AND NOT has_role(auth.uid(), 'admin'::app_role)
  AND NOT has_role(auth.uid(), 'seo_admin'::app_role)
);
