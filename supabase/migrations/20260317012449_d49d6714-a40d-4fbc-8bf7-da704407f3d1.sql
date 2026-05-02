
CREATE TABLE public.cms_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE NOT NULL,
  title text NOT NULL,
  html_content text NOT NULL DEFAULT '',
  css_content text NOT NULL DEFAULT '',
  gjs_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_published boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cms_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published cms pages"
  ON public.cms_pages FOR SELECT
  USING (is_published = true);

CREATE POLICY "Admins can manage all cms pages"
  ON public.cms_pages FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.cms_pages (slug, title) VALUES
  ('header', 'Header / Navigation'),
  ('footer', 'Footer'),
  ('home-hero', 'Homepage Hero'),
  ('home-body', 'Homepage Body');
