
-- Add badge icon URL column to membership_plans
ALTER TABLE public.membership_plans ADD COLUMN badge_icon_url text;

-- Create storage bucket for membership badge icons
INSERT INTO storage.buckets (id, name, public) VALUES ('membership-badges', 'membership-badges', true)
ON CONFLICT (id) DO NOTHING;

-- Allow admins to upload badge icons
CREATE POLICY "Admins can manage badge icons" ON storage.objects
  FOR ALL USING (bucket_id = 'membership-badges' AND has_role(auth.uid(), 'admin'::app_role));

-- Anyone can view badge icons (public bucket)
CREATE POLICY "Anyone can view badge icons" ON storage.objects
  FOR SELECT USING (bucket_id = 'membership-badges');
