-- Fix 1: Restrict pet_adoptions UPDATE policies to authenticated role only
DROP POLICY IF EXISTS "Users can update adoption listings" ON public.pet_adoptions;

CREATE POLICY "Users can update adoption listings"
ON public.pet_adoptions
FOR UPDATE
TO authenticated
USING (
  (auth.uid() = owner_id) OR (auth.uid() = adopter_id) OR ((status = 'available') AND (adopter_id IS NULL))
)
WITH CHECK (
  (auth.uid() = owner_id) OR (auth.uid() = adopter_id) OR ((status = 'pending') AND (adopter_id = auth.uid()))
);

-- Fix 2: Drop and recreate views as SECURITY INVOKER
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
WITH (security_invoker = true)
AS
SELECT id, name, species, breed, age, color, weight, pet_code, owner_id, status, created_at, updated_at
FROM public.pets;

DROP VIEW IF EXISTS public.lost_reports_public;
CREATE VIEW public.lost_reports_public
WITH (security_invoker = true)
AS
SELECT id, pet_id, reporter_id, status, description, last_seen_address, last_seen_lat, last_seen_lng, reward, created_at, updated_at
FROM public.lost_reports;

DROP VIEW IF EXISTS public.payment_settings_safe;
CREATE VIEW public.payment_settings_safe
WITH (security_invoker = true)
AS
SELECT id, provider, publishable_key, is_active, updated_at
FROM public.payment_settings;

-- Grant SELECT on views to appropriate roles
GRANT SELECT ON public.pets_public TO anon, authenticated;
GRANT SELECT ON public.lost_reports_public TO anon, authenticated;
GRANT SELECT ON public.payment_settings_safe TO authenticated;