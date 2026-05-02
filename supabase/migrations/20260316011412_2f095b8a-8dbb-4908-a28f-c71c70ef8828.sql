
-- Pet health records (weight, height, notes over time)
CREATE TABLE public.pet_health_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  record_date DATE NOT NULL DEFAULT CURRENT_DATE,
  weight_kg NUMERIC,
  height_cm NUMERIC,
  temperature NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_health_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage health records" ON public.pet_health_records
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_health_records.pet_id AND pets.owner_id = auth.uid())
);

CREATE POLICY "Admins can manage all health records" ON public.pet_health_records
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Pet vaccinations
CREATE TABLE public.pet_vaccinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  date_given DATE NOT NULL,
  next_due_date DATE,
  vet_name TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage vaccinations" ON public.pet_vaccinations
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.pets WHERE pets.id = pet_vaccinations.pet_id AND pets.owner_id = auth.uid())
);

CREATE POLICY "Admins can manage all vaccinations" ON public.pet_vaccinations
FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Pet adoptions
CREATE TABLE public.pet_adoptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL,
  adopter_id UUID,
  status TEXT NOT NULL DEFAULT 'available',
  adoption_fee NUMERIC DEFAULT 0,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_adoptions ENABLE ROW LEVEL SECURITY;

-- Anyone can view available adoptions
CREATE POLICY "Anyone can view available adoptions" ON public.pet_adoptions
FOR SELECT USING (status = 'available' OR owner_id = auth.uid() OR adopter_id = auth.uid());

-- Owners can create adoption listings
CREATE POLICY "Owners can create adoption listings" ON public.pet_adoptions
FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Owners can update their listings
CREATE POLICY "Owners can update adoption listings" ON public.pet_adoptions
FOR UPDATE USING (auth.uid() = owner_id OR auth.uid() = adopter_id);

-- Admins can manage all
CREATE POLICY "Admins can manage all adoptions" ON public.pet_adoptions
FOR ALL USING (public.has_role(auth.uid(), 'admin'));
