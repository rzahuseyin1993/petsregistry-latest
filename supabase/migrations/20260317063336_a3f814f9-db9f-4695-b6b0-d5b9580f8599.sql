
-- Donation packages (admin-configurable)
CREATE TABLE public.donation_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.donation_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active donation packages" ON public.donation_packages
  FOR SELECT TO public USING (is_active = true OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage donation packages" ON public.donation_packages
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

-- Donations table
CREATE TABLE public.donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donor_name TEXT,
  donor_email TEXT,
  user_id UUID,
  amount NUMERIC NOT NULL,
  message TEXT,
  payment_method TEXT,
  payment_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  package_id UUID REFERENCES public.donation_packages(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage all donations" ON public.donations
  FOR ALL TO public USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Anyone can create donations" ON public.donations
  FOR INSERT TO public WITH CHECK (true);

CREATE POLICY "Users can view own donations" ON public.donations
  FOR SELECT TO public USING (user_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- Insert default packages
INSERT INTO public.donation_packages (name, amount, description, sort_order) VALUES
  ('Coffee', 5, 'Buy us a coffee ☕', 1),
  ('Supporter', 15, 'Help feed a shelter pet 🐾', 2),
  ('Champion', 50, 'Fund a pet rescue mission 🏆', 3),
  ('Hero', 100, 'Sponsor a full pet rehoming 🦸', 4);
