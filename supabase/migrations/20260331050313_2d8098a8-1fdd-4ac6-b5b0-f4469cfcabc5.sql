
-- Fix 1: Business-listings storage DELETE policy - add ownership check
DROP POLICY IF EXISTS "Owners can delete business listing images" ON storage.objects;
CREATE POLICY "Owners can delete own listing images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'business-listings'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

-- Fix 2: Recreate pets_public view without owner_id and notes, and without security_invoker
-- so it bypasses base table RLS (allowing public browsing) but excludes sensitive columns
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public AS
  SELECT id, name, species, breed, age, color, weight, pet_code, status, created_at, updated_at
  FROM public.pets;

GRANT SELECT ON public.pets_public TO anon, authenticated;

-- Fix 3: Create a view for payment_settings that excludes secret_key
CREATE OR REPLACE VIEW public.payment_settings_safe AS
  SELECT id, provider, publishable_key, is_active, updated_at
  FROM public.payment_settings;

GRANT SELECT ON public.payment_settings_safe TO authenticated;
