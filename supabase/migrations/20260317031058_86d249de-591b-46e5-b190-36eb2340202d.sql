-- Create storage bucket for flyer templates
INSERT INTO storage.buckets (id, name, public) VALUES ('flyer-templates', 'flyer-templates', true);

-- Storage policies
CREATE POLICY "Anyone can view flyer templates" ON storage.objects FOR SELECT USING (bucket_id = 'flyer-templates');
CREATE POLICY "Authenticated can upload flyer templates" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'flyer-templates');
CREATE POLICY "Owners can delete own flyer templates" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'flyer-templates' AND (auth.uid()::text = (storage.foldername(name))[1]));

-- Create flyer_templates table
CREATE TABLE public.flyer_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  created_by uuid NOT NULL,
  template_type text NOT NULL DEFAULT 'member',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.flyer_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active templates" ON public.flyer_templates
  FOR SELECT USING (is_active = true OR created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated can create templates" ON public.flyer_templates
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners can update own templates" ON public.flyer_templates
  FOR UPDATE USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Owners can delete own templates" ON public.flyer_templates
  FOR DELETE USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));