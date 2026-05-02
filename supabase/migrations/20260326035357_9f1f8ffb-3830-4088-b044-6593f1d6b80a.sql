
-- Pet Certificates table
CREATE TABLE public.pet_certificates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  pet_id uuid NOT NULL REFERENCES public.pets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'draft',
  is_paid boolean NOT NULL DEFAULT false,
  payment_id text,
  design_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  html_content text NOT NULL DEFAULT '',
  css_content text NOT NULL DEFAULT '',
  is_paused boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_certificates ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own certificates" ON public.pet_certificates FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can insert own certificates" ON public.pet_certificates FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own certificates" ON public.pet_certificates FOR UPDATE USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete certificates" ON public.pet_certificates FOR DELETE USING (public.has_role(auth.uid(), 'admin'));

-- Updated_at trigger
CREATE TRIGGER update_pet_certificates_updated_at
  BEFORE UPDATE ON public.pet_certificates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
