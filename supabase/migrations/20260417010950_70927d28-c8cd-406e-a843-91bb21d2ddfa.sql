
-- Comprehensive secure search across pets, including owner name and microchip
-- Returns only pet IDs - the client then fetches public-safe data via pets_public view
CREATE OR REPLACE FUNCTION public.search_pets_global(_query text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id
  FROM public.pets p
  LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id
  WHERE _query IS NOT NULL AND length(trim(_query)) > 0
    AND (
      p.name ILIKE '%' || _query || '%'
      OR p.species ILIKE '%' || _query || '%'
      OR p.breed ILIKE '%' || _query || '%'
      OR p.pet_code ILIKE '%' || _query || '%'
      OR p.microchip_number ILIKE '%' || _query || '%'
      OR p.id::text ILIKE '%' || _query || '%'
      OR (pr.show_name = true AND pr.full_name ILIKE '%' || _query || '%')
    )
  LIMIT 100
$$;
