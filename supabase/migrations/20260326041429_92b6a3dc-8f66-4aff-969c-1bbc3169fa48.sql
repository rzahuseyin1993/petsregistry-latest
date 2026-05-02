
-- Custom map pins table for admin-placed markers
CREATE TABLE public.map_custom_pins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'custom',
  lat NUMERIC NOT NULL,
  lng NUMERIC NOT NULL,
  emoji TEXT NOT NULL DEFAULT '📍',
  color TEXT NOT NULL DEFAULT '#ef4444',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.map_custom_pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage custom pins" ON public.map_custom_pins FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view active pins" ON public.map_custom_pins FOR SELECT USING (is_active = true);

-- Map settings in site_settings
INSERT INTO public.site_settings (key, value, description) VALUES
  ('map_default_lat', '1.3521', 'Default map center latitude'),
  ('map_default_lng', '103.8198', 'Default map center longitude'),
  ('map_default_zoom', '13', 'Default map zoom level'),
  ('map_show_vets', 'true', 'Show veterinary markers on map'),
  ('map_show_pet_shops', 'true', 'Show pet shop markers on map'),
  ('map_show_parks', 'true', 'Show park markers on map'),
  ('map_show_shelters', 'true', 'Show shelter markers on map'),
  ('map_show_grooming', 'true', 'Show grooming markers on map'),
  ('map_show_directory', 'true', 'Show directory business listings on map')
ON CONFLICT (key) DO NOTHING;
