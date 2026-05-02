-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view site settings" ON public.site_settings;

-- Allow only authenticated users to read site settings
CREATE POLICY "Authenticated can view site settings"
  ON public.site_settings
  FOR SELECT
  TO authenticated
  USING (true);