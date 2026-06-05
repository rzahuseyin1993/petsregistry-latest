-- Store reporter country (from IP at submit, or member profile) for geo filtering
ALTER TABLE public.lost_reports
  ADD COLUMN IF NOT EXISTS reporter_country text;

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
  lr.last_seen_date,
  lr.reward,
  lr.created_at,
  lr.updated_at,
  lr.is_guest,
  lr.guest_pet_name,
  lr.guest_pet_species,
  lr.guest_pet_breed,
  lr.guest_pet_photo_url,
  COALESCE(lr.reporter_country, rpr.country, pr.country) AS owner_country
FROM public.lost_reports lr
JOIN public.pets p ON p.id = lr.pet_id
LEFT JOIN public.profiles pr ON pr.user_id = p.owner_id
LEFT JOIN public.profiles rpr ON rpr.user_id = lr.reporter_id
WHERE lr.status = 'active'
  AND lr.is_paused = false;

GRANT SELECT ON public.lost_reports_public TO anon, authenticated;
