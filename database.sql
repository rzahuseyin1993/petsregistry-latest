-- ============================================================
-- PET PALACE HUB — Complete Database Schema
-- Generated: 2026-03-19
-- Target: Supabase (PostgreSQL 15+)
-- ============================================================

-- ============ ENUM ============

CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- ============ SEQUENCE ============

CREATE SEQUENCE IF NOT EXISTS public.pet_code_seq;

-- ============ TABLES ============

-- 1. profiles
CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  phone text,
  avatar_url text,
  address text,
  city text,
  country text,
  race text,
  show_name boolean NOT NULL DEFAULT true,
  show_phone boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. user_roles
CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

-- 3. pets
CREATE TABLE public.pets (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  species text NOT NULL,
  breed text,
  age text,
  color text,
  weight text,
  microchip_number text,
  pet_code text,
  notes text,
  status text NOT NULL DEFAULT 'registered',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. pet_images
CREATE TABLE public.pet_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. pet_health_records
CREATE TABLE public.pet_health_records (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_date date NOT NULL DEFAULT CURRENT_DATE,
  weight_kg numeric,
  height_cm numeric,
  temperature numeric,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. pet_vaccinations
CREATE TABLE public.pet_vaccinations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name text NOT NULL,
  date_given date NOT NULL,
  next_due_date date,
  vet_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 7. pet_adoptions
CREATE TABLE public.pet_adoptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  adopter_id uuid,
  status text NOT NULL DEFAULT 'available',
  description text,
  adoption_fee numeric DEFAULT 0,
  admin_approved boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 8. lost_reports
CREATE TABLE public.lost_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'active',
  description text,
  last_seen_address text,
  last_seen_lat numeric,
  last_seen_lng numeric,
  contact_phone text,
  reward text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 9. membership_plans
CREATE TABLE public.membership_plans (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  plan_type text NOT NULL DEFAULT 'guardian',
  description text,
  price numeric NOT NULL DEFAULT 5,
  duration_days integer NOT NULL DEFAULT 365,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 10. memberships
CREATE TABLE public.memberships (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  plan_id uuid NOT NULL REFERENCES public.membership_plans(id),
  status text NOT NULL DEFAULT 'active',
  payment_id text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 11. products
CREATE TABLE public.products (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  price numeric NOT NULL,
  image_url text,
  category text,
  stock integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 12. orders
CREATE TABLE public.orders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  payment_id text,
  payment_method text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 13. order_items
CREATE TABLE public.order_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id),
  quantity integer NOT NULL DEFAULT 1,
  price numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 14. donation_packages
CREATE TABLE public.donation_packages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  amount numeric NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 15. donations
CREATE TABLE public.donations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid,
  package_id uuid REFERENCES public.donation_packages(id),
  amount numeric NOT NULL,
  donor_name text,
  donor_email text,
  message text,
  payment_id text,
  payment_method text,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 16. notifications
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 17. admin_messages
CREATE TABLE public.admin_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  is_html boolean NOT NULL DEFAULT false,
  attachment_urls jsonb DEFAULT '[]'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 18. contact_submissions
CREATE TABLE public.contact_submissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  email text NOT NULL,
  subject text NOT NULL DEFAULT '',
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  admin_reply text,
  replied_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 19. business_listings
CREATE TABLE public.business_listings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid NOT NULL,
  name text NOT NULL,
  category text NOT NULL DEFAULT 'pet_shop',
  description text,
  email text,
  phone text,
  website text,
  address text,
  city text,
  country text,
  is_active boolean NOT NULL DEFAULT true,
  is_approved boolean NOT NULL DEFAULT false,
  is_featured boolean NOT NULL DEFAULT false,
  is_paid boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 20. business_listing_images
CREATE TABLE public.business_listing_images (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id uuid NOT NULL REFERENCES public.business_listings(id) ON DELETE CASCADE,
  image_url text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 21. cms_pages
CREATE TABLE public.cms_pages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL UNIQUE,
  html_content text NOT NULL DEFAULT '',
  css_content text NOT NULL DEFAULT '',
  gjs_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 22. flyer_templates
CREATE TABLE public.flyer_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  template_type text NOT NULL DEFAULT 'member',
  created_by uuid NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 23. flyer_subscriptions
CREATE TABLE public.flyer_subscriptions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  payment_id text,
  status text NOT NULL DEFAULT 'active',
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 24. payment_settings
CREATE TABLE public.payment_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider text NOT NULL,
  publishable_key text,
  secret_key text,
  is_active boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 25. site_settings
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  description text,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ============ FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.generate_pet_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.pet_code IS NULL OR NEW.pet_code = '' THEN
    NEW.pet_code := 'PR-' || EXTRACT(YEAR FROM now())::int || '-' || nextval('public.pet_code_seq');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_profile(_user_id uuid)
RETURNS json
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT json_build_object(
    'full_name', CASE WHEN show_name THEN full_name ELSE NULL END,
    'phone', CASE WHEN show_phone THEN phone ELSE NULL END,
    'email', email,
    'show_name', show_name,
    'show_phone', show_phone
  )
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ============ TRIGGERS ============

CREATE TRIGGER generate_pet_code_trigger
  BEFORE INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.generate_pet_code();

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TRIGGER update_pets_updated_at
  BEFORE UPDATE ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_business_listings_updated_at
  BEFORE UPDATE ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_membership_plans_updated_at
  BEFORE UPDATE ON public.membership_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_adoptions_updated_at
  BEFORE UPDATE ON public.pet_adoptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lost_reports_updated_at
  BEFORE UPDATE ON public.lost_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cms_pages_updated_at
  BEFORE UPDATE ON public.cms_pages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- ============ ENABLE RLS ON ALL TABLES ============

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_health_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_adoptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lost_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membership_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donation_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_listing_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flyer_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.flyer_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;


-- ============ RLS POLICIES ============

-- profiles
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- pets
CREATE POLICY "Pets viewable by everyone" ON public.pets FOR SELECT USING (true);
CREATE POLICY "Owners can insert pets" ON public.pets FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update pets" ON public.pets FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete pets" ON public.pets FOR DELETE USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all pets" ON public.pets FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- pet_images
CREATE POLICY "Pet images viewable by everyone" ON public.pet_images FOR SELECT USING (true);
CREATE POLICY "Pet owners can manage images" ON public.pet_images FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_images.pet_id AND pets.owner_id = auth.uid())
);
CREATE POLICY "Pet owners can delete images" ON public.pet_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_images.pet_id AND pets.owner_id = auth.uid())
);

-- pet_health_records
CREATE POLICY "Owners can manage health records" ON public.pet_health_records FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_health_records.pet_id AND pets.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all health records" ON public.pet_health_records FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- pet_vaccinations
CREATE POLICY "Owners can manage vaccinations" ON public.pet_vaccinations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_vaccinations.pet_id AND pets.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all vaccinations" ON public.pet_vaccinations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- pet_adoptions
CREATE POLICY "Anyone can view available adoptions" ON public.pet_adoptions FOR SELECT USING (
  status = 'available' OR owner_id = auth.uid() OR adopter_id = auth.uid()
);
CREATE POLICY "Owners can create adoption listings" ON public.pet_adoptions FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update adoption listings" ON public.pet_adoptions FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = adopter_id);
CREATE POLICY "Admins can manage all adoptions" ON public.pet_adoptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- lost_reports
CREATE POLICY "Anyone can view active lost reports" ON public.lost_reports FOR SELECT USING (status = 'active' OR reporter_id = auth.uid());
CREATE POLICY "Owners can create lost reports" ON public.lost_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Owners can update lost reports" ON public.lost_reports FOR UPDATE USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage all lost reports" ON public.lost_reports FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- membership_plans
CREATE POLICY "Anyone can view active plans" ON public.membership_plans FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage plans" ON public.membership_plans FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- memberships
CREATE POLICY "Users can view own memberships" ON public.memberships FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Authenticated can create memberships" ON public.memberships FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all memberships" ON public.memberships FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- products
CREATE POLICY "Products viewable by everyone" ON public.products FOR SELECT USING (active = true);
CREATE POLICY "Admins can manage products" ON public.products FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- orders
CREATE POLICY "Users can view own orders" ON public.orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all orders" ON public.orders FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- order_items
CREATE POLICY "Users can view own order items" ON public.order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users can insert order items" ON public.order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admins can manage all order items" ON public.order_items FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- donation_packages
CREATE POLICY "Anyone can view active donation packages" ON public.donation_packages FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage donation packages" ON public.donation_packages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- donations
CREATE POLICY "Anyone can create donations" ON public.donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can view own donations" ON public.donations FOR SELECT USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage all donations" ON public.donations FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- notifications
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Authenticated can insert notifications" ON public.notifications FOR INSERT TO authenticated WITH CHECK (true);

-- admin_messages
CREATE POLICY "Admins can manage all messages" ON public.admin_messages FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can view own messages" ON public.admin_messages FOR SELECT TO authenticated USING (auth.uid() = recipient_id);
CREATE POLICY "Users can update own messages" ON public.admin_messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

-- contact_submissions
CREATE POLICY "Anyone can submit contact form" ON public.contact_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can manage contact submissions" ON public.contact_submissions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- business_listings
CREATE POLICY "Anyone can view active approved listings" ON public.business_listings FOR SELECT USING (
  (is_active = true AND is_approved = true) OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Authenticated can create listings" ON public.business_listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update own listings" ON public.business_listings FOR UPDATE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete listings" ON public.business_listings FOR DELETE USING (auth.uid() = owner_id OR public.has_role(auth.uid(), 'admin'));

-- business_listing_images
CREATE POLICY "Anyone can view listing images" ON public.business_listing_images FOR SELECT USING (true);
CREATE POLICY "Listing owners can manage images" ON public.business_listing_images FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.business_listings WHERE business_listings.id = business_listing_images.listing_id AND business_listings.owner_id = auth.uid())
);
CREATE POLICY "Listing owners can delete images" ON public.business_listing_images FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.business_listings WHERE business_listings.id = business_listing_images.listing_id AND business_listings.owner_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin')
);

-- cms_pages
CREATE POLICY "Anyone can view published cms pages" ON public.cms_pages FOR SELECT USING (is_published = true);
CREATE POLICY "Admins can manage all cms pages" ON public.cms_pages FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- flyer_templates
CREATE POLICY "Anyone can view active templates" ON public.flyer_templates FOR SELECT USING (
  is_active = true OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin')
);
CREATE POLICY "Authenticated can create templates" ON public.flyer_templates FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners can update own templates" ON public.flyer_templates FOR UPDATE USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners can delete own templates" ON public.flyer_templates FOR DELETE USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

-- flyer_subscriptions
CREATE POLICY "Users can view own flyer subscriptions" ON public.flyer_subscriptions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Service can insert flyer subscriptions" ON public.flyer_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all flyer subscriptions" ON public.flyer_subscriptions FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- payment_settings
CREATE POLICY "Admins can manage payment settings" ON public.payment_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- site_settings
CREATE POLICY "Anyone can view site settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Admins can manage site settings" ON public.site_settings FOR ALL USING (public.has_role(auth.uid(), 'admin'));


-- ============ STORAGE BUCKETS ============
-- Run these via Supabase dashboard or SQL editor:

INSERT INTO storage.buckets (id, name, public) VALUES ('pet-photos', 'pet-photos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('flyer-templates', 'flyer-templates', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('business-listings', 'business-listings', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-attachments', 'admin-attachments', true) ON CONFLICT DO NOTHING;


-- ============ REALTIME (if needed) ============
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_messages;


-- ============ END OF SCHEMA ============
