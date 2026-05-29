-- Expose owner country on public browse views (from profiles.country)
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
WITH (security_invoker = true)
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

DROP VIEW IF EXISTS public.lost_reports_public;
CREATE VIEW public.lost_reports_public
WITH (security_invoker = true)
AS
SELECT
  lr.id,
  lr.pet_id,
  lr.reporter_id,
  lr.status,
  lr.description,
  lr.last_seen_address,
  lr.last_seen_lat,
  lr.last_seen_lng,
  lr.reward,
  lr.created_at,
  lr.updated_at,
  pr.country AS owner_country
FROM public.lost_reports lr
JOIN public.pets p ON p.id = lr.pet_id
LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id;

CREATE OR REPLACE VIEW public.pet_adoptions_browse
WITH (security_invoker = true)
AS
SELECT
  pa.*,
  pr.country AS owner_country
FROM public.pet_adoptions pa
LEFT JOIN public.profiles pr ON pr.user_id = pa.owner_id
WHERE pa.status = 'available'
  AND pa.admin_approved = true;

GRANT SELECT ON public.pets_public TO anon, authenticated;
GRANT SELECT ON public.lost_reports_public TO anon, authenticated;
GRANT SELECT ON public.pet_adoptions_browse TO anon, authenticated;

-- Match stored profile country against visitor country name or ISO code
CREATE OR REPLACE FUNCTION public.country_matches(stored text, visitor text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    visitor IS NULL
    OR btrim(visitor) = ''
    OR (
      stored IS NOT NULL
      AND btrim(stored) <> ''
      AND (
    lower(btrim(stored)) = lower(btrim(visitor))
    OR (
      length(btrim(visitor)) = 2
      AND lower(btrim(stored)) IN (
        lower(btrim(visitor)),
        CASE lower(btrim(visitor))
          WHEN 'sg' THEN 'singapore'
          WHEN 'us' THEN 'united states'
          WHEN 'gb' THEN 'united kingdom'
          WHEN 'uk' THEN 'united kingdom'
          WHEN 'au' THEN 'australia'
          WHEN 'my' THEN 'malaysia'
          WHEN 'in' THEN 'india'
          WHEN 'ph' THEN 'philippines'
          WHEN 'id' THEN 'indonesia'
          WHEN 'th' THEN 'thailand'
          WHEN 'vn' THEN 'vietnam'
          WHEN 'ca' THEN 'canada'
          WHEN 'de' THEN 'germany'
          WHEN 'fr' THEN 'france'
          WHEN 'jp' THEN 'japan'
          WHEN 'cn' THEN 'china'
          WHEN 'hk' THEN 'hong kong'
          WHEN 'nz' THEN 'new zealand'
          ELSE lower(btrim(visitor))
        END
      )
    )
    OR (
      length(btrim(stored)) = 2
      AND lower(btrim(visitor)) IN (
        lower(btrim(stored)),
        CASE lower(btrim(stored))
          WHEN 'sg' THEN 'singapore'
          WHEN 'us' THEN 'united states'
          WHEN 'gb' THEN 'united kingdom'
          WHEN 'uk' THEN 'united kingdom'
          WHEN 'au' THEN 'australia'
          WHEN 'my' THEN 'malaysia'
          ELSE lower(btrim(stored))
        END
      )
    )
    OR lower(btrim(stored)) LIKE '%' || lower(btrim(visitor)) || '%'
    OR lower(btrim(visitor)) LIKE '%' || lower(btrim(stored)) || '%'
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.search_pets_global(_query text, _country text DEFAULT NULL)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id
  FROM public.pets p
  LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id
  WHERE _query IS NOT NULL
    AND length(btrim(_query)) > 0
    AND (
      _country IS NULL
      OR btrim(_country) = ''
      OR public.country_matches(pr.country, _country)
    )
    AND (
      p.name ILIKE '%' || _query || '%'
      OR p.species ILIKE '%' || _query || '%'
      OR p.breed ILIKE '%' || _query || '%'
      OR p.pet_code ILIKE '%' || _query || '%'
      OR p.microchip_number ILIKE '%' || _query || '%'
      OR p.id::text ILIKE '%' || _query || '%'
      OR (pr.show_name = true AND pr.full_name ILIKE '%' || _query || '%')
    )
  LIMIT 100;
$$;
