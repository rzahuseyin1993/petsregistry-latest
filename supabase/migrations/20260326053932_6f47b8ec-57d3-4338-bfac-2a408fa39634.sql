
-- 1. Fix pets_public view: recreate with security_invoker=on
DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public
WITH (security_invoker=on) AS
  SELECT id, owner_id, name, species, breed, age, color, weight, pet_code, notes, status, created_at, updated_at
  FROM public.pets;

-- 2. Create lost_reports_public view WITHOUT contact_phone (security_invoker=on)
CREATE VIEW public.lost_reports_public
WITH (security_invoker=on) AS
  SELECT id, pet_id, reporter_id, status, description, last_seen_address, last_seen_lat, last_seen_lng, reward, created_at, updated_at
  FROM public.lost_reports;

-- 3. Restrict base lost_reports SELECT: only authenticated users can see active reports (with contact_phone)
-- Drop the old permissive public policy
DROP POLICY IF EXISTS "Anyone can view active lost reports" ON public.lost_reports;

-- Authenticated users can view active reports OR their own
CREATE POLICY "Authenticated can view active lost reports" ON public.lost_reports
  FOR SELECT TO authenticated
  USING (status = 'active' OR reporter_id = auth.uid());
