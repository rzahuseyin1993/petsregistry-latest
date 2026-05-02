
-- Business listings table
CREATE TABLE public.business_listings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'pet_shop',
  address TEXT,
  city TEXT,
  country TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  is_paid BOOLEAN NOT NULL DEFAULT false,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Business listing images (for paid listings)
CREATE TABLE public.business_listing_images (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID NOT NULL REFERENCES public.business_listings(id) ON DELETE CASCADE,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Membership plans (admin configurable)
CREATE TABLE public.membership_plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 5,
  duration_days INTEGER NOT NULL DEFAULT 365,
  plan_type TEXT NOT NULL DEFAULT 'guardian',
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User memberships
CREATE TABLE public.memberships (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  plan_id UUID NOT NULL REFERENCES public.membership_plans(id),
  status TEXT NOT NULL DEFAULT 'active',
  payment_id TEXT,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Storage bucket for business listing images
INSERT INTO storage.buckets (id, name, public) VALUES ('business-listings', 'business-listings', true)
ON CONFLICT (id) DO NOTHING;

-- RLS for business_listings
ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active approved listings" ON public.business_listings
  FOR SELECT USING (
    (is_active = true AND is_approved = true) 
    OR owner_id = auth.uid() 
    OR has_role(auth.uid(), 'admin'::app_role)
  );

CREATE POLICY "Authenticated can create listings" ON public.business_listings
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update own listings" ON public.business_listings
  FOR UPDATE USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete listings" ON public.business_listings
  FOR DELETE USING (auth.uid() = owner_id OR has_role(auth.uid(), 'admin'::app_role));

-- RLS for business_listing_images
ALTER TABLE public.business_listing_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view listing images" ON public.business_listing_images
  FOR SELECT USING (true);

CREATE POLICY "Listing owners can manage images" ON public.business_listing_images
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.business_listings WHERE id = listing_id AND owner_id = auth.uid())
  );

CREATE POLICY "Listing owners can delete images" ON public.business_listing_images
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.business_listings WHERE id = listing_id AND owner_id = auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
  );

-- RLS for membership_plans
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active plans" ON public.membership_plans
  FOR SELECT USING (is_active = true OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage plans" ON public.membership_plans
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS for memberships
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own memberships" ON public.memberships
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated can create memberships" ON public.memberships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can manage all memberships" ON public.memberships
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Storage policies for business-listings bucket
CREATE POLICY "Anyone can view business listing images" ON storage.objects
  FOR SELECT USING (bucket_id = 'business-listings');

CREATE POLICY "Authenticated can upload business listing images" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'business-listings');

CREATE POLICY "Owners can delete business listing images" ON storage.objects
  FOR DELETE USING (bucket_id = 'business-listings' AND auth.role() = 'authenticated');

-- Insert default membership plans
INSERT INTO public.membership_plans (name, slug, description, price, duration_days, plan_type, features) VALUES
('Guardian Member', 'guardian-member', 'Annual membership for pet owners. Get featured in the directory and priority lost pet alerts.', 5, 365, 'guardian', '["Featured directory listing", "Priority lost pet alerts", "Verified badge"]'::jsonb),
('Verified Partner', 'verified-partner', 'Annual membership for pet businesses. Get a verified badge, dedicated profile page with photos, and featured placement.', 5, 365, 'partner', '["Verified Partner badge", "Dedicated profile page", "Photo gallery", "Featured placement", "Direct contact buttons"]'::jsonb);
