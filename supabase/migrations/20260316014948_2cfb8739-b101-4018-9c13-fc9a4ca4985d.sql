
CREATE TABLE public.site_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view site settings" ON public.site_settings
  FOR SELECT TO public USING (true);

CREATE POLICY "Admins can manage site settings" ON public.site_settings
  FOR ALL TO public USING (public.has_role(auth.uid(), 'admin'));

-- Insert default settings
INSERT INTO public.site_settings (key, value, description) VALUES
  ('site_email', 'admin@petsregistry.org', 'Main site contact and notification email'),
  ('notification_email', 'admin@petsregistry.org', 'Email address for sending notifications'),
  ('support_email', 'admin@petsregistry.org', 'Support/contact form recipient email'),
  ('site_name', 'PetsRegistry', 'Site display name'),
  ('lost_pet_alert_radius_km', '5', 'Radius in km for lost pet alerts');
