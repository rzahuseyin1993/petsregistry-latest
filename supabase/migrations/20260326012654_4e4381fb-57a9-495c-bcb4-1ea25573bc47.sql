
-- Drop the overly permissive public SELECT policy on base pets table
DROP POLICY IF EXISTS "Pets viewable by everyone" ON public.pets;

-- Add owner-only SELECT policy on base table (admin ALL policy already exists)
CREATE POLICY "Owners can view own pets"
  ON public.pets FOR SELECT
  TO authenticated
  USING (auth.uid() = owner_id);

-- Create a public view that excludes microchip_number
-- Uses security_invoker = false (default) so it bypasses base table RLS
CREATE OR REPLACE VIEW public.pets_public AS
SELECT
  id, owner_id, name, species, breed, age, color, weight,
  pet_code, notes, status, created_at, updated_at
FROM public.pets;

-- Grant access to the view for all roles
GRANT SELECT ON public.pets_public TO anon, authenticated;
