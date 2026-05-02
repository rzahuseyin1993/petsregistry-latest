
-- Certificate templates table (admin-designed)
CREATE TABLE public.certificate_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  background_url text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  colors jsonb NOT NULL DEFAULT '{"bg":"#FFFDF7","accent":"#8B7355","text":"#2D2A26","border":"#C9B88C"}'::jsonb,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active certificate templates" ON public.certificate_templates FOR SELECT USING (is_active = true OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can manage certificate templates" ON public.certificate_templates FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_certificate_templates_updated_at
  BEFORE UPDATE ON public.certificate_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add template_id to pet_certificates
ALTER TABLE public.pet_certificates ADD COLUMN template_id uuid REFERENCES public.certificate_templates(id);
