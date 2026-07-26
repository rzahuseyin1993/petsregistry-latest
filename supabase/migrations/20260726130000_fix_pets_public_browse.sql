-- Registered pets must be publicly searchable/browsable via pets_public.
-- With security_invoker = true, base-table RLS hid all non-lost / non-adoption pets
-- (search_pets_global found IDs, then pets_public returned []).
-- Same approach as lost_reports_public browse fix.

DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.name,
  p.species,
  p.breed,
  p.age,
  p.color,
  p.weight,
  p.pet_code,
  p.owner_id,
  p.status,
  p.created_at,
  p.updated_at,
  pr.country AS owner_country
FROM public.pets p
LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id;

GRANT SELECT ON public.pets_public TO anon, authenticated;
