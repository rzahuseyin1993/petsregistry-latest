-- Pet ID / microchip lookups should work worldwide; broaden text search fields.
CREATE OR REPLACE FUNCTION public.search_pets_global(_query text, _country text DEFAULT NULL)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  WITH q AS (
    SELECT btrim(_query) AS raw, replace(upper(btrim(_query)), '-', '') AS norm
  )
  SELECT DISTINCT p.id
  FROM public.pets p
  LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id
  CROSS JOIN q
  WHERE q.raw IS NOT NULL
    AND length(q.raw) > 0
    AND (
      -- Identifier fields: always searchable globally
      replace(upper(coalesce(p.pet_code, '')), '-', '') LIKE '%' || q.norm || '%'
      OR replace(coalesce(p.microchip_number, ''), ' ', '') ILIKE '%' || replace(q.raw, ' ', '') || '%'
      OR p.id::text ILIKE q.raw
      OR (
        -- General text fields: respect visitor country when provided
        (_country IS NULL OR btrim(_country) = '' OR public.country_matches(pr.country, _country))
        AND (
          p.name ILIKE '%' || q.raw || '%'
          OR p.species ILIKE '%' || q.raw || '%'
          OR p.breed ILIKE '%' || q.raw || '%'
          OR coalesce(p.color, '') ILIKE '%' || q.raw || '%'
          OR coalesce(p.age, '') ILIKE '%' || q.raw || '%'
          OR coalesce(p.weight, '') ILIKE '%' || q.raw || '%'
          OR coalesce(p.notes, '') ILIKE '%' || q.raw || '%'
          OR (pr.show_name = true AND pr.full_name ILIKE '%' || q.raw || '%')
        )
      )
    )
  LIMIT 100;
$$;
