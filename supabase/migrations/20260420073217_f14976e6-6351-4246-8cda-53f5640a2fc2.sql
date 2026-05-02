
-- 1. Allow guest lost reports
ALTER TABLE public.lost_reports
  ALTER COLUMN reporter_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS guest_name text,
  ADD COLUMN IF NOT EXISTS guest_email text,
  ADD COLUMN IF NOT EXISTS guest_phone text,
  ADD COLUMN IF NOT EXISTS guest_pet_name text,
  ADD COLUMN IF NOT EXISTS guest_pet_species text,
  ADD COLUMN IF NOT EXISTS guest_pet_breed text,
  ADD COLUMN IF NOT EXISTS guest_pet_photo_url text,
  ADD COLUMN IF NOT EXISTS is_guest boolean NOT NULL DEFAULT false;

-- Allow anonymous (guest) inserts
DROP POLICY IF EXISTS "Guests can create lost reports" ON public.lost_reports;
CREATE POLICY "Guests can create lost reports"
  ON public.lost_reports FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    (auth.uid() IS NULL AND is_guest = true AND reporter_id IS NULL)
    OR (auth.uid() = reporter_id)
  );

-- Public can view active reports (so /lost-pets keeps working for anon too)
DROP POLICY IF EXISTS "Public can view active lost reports" ON public.lost_reports;
CREATE POLICY "Public can view active lost reports"
  ON public.lost_reports FOR SELECT
  TO anon, authenticated
  USING (status = 'active' OR reporter_id = auth.uid());

-- 2. Pet scan logs (QR scans from /scan/:petId)
CREATE TABLE IF NOT EXISTS public.pet_scan_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id uuid NOT NULL,
  scanner_user_id uuid,
  lat numeric,
  lng numeric,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pet_scan_logs_pet ON public.pet_scan_logs(pet_id, created_at DESC);

ALTER TABLE public.pet_scan_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert scan log" ON public.pet_scan_logs;
CREATE POLICY "Anyone can insert scan log"
  ON public.pet_scan_logs FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Owners can view their pet scans" ON public.pet_scan_logs;
CREATE POLICY "Owners can view their pet scans"
  ON public.pet_scan_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.pets p WHERE p.id = pet_scan_logs.pet_id AND p.owner_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );
