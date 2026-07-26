-- Expose owner city for public location filtering on search/browse.
-- Keep street address private (not included).

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
  pr.country AS owner_country,
  NULLIF(btrim(pr.city), '') AS owner_city
FROM public.pets p
LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id;

DROP VIEW IF EXISTS public.pet_adoptions_browse;
CREATE VIEW public.pet_adoptions_browse
WITH (security_invoker = false)
AS
SELECT
  pa.*,
  pr.country AS owner_country,
  NULLIF(btrim(pr.city), '') AS owner_city
FROM public.pet_adoptions pa
LEFT JOIN public.profiles pr ON pr.user_id = pa.owner_id
WHERE pa.status = 'available'
  AND pa.admin_approved = true;

GRANT SELECT ON public.pets_public TO anon, authenticated;
GRANT SELECT ON public.pet_adoptions_browse TO anon, authenticated;
