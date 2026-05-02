
-- Allow seo_admin to manage blog posts
CREATE POLICY "SEO admins can manage blog posts"
ON public.blog_posts
FOR ALL
USING (has_role(auth.uid(), 'seo_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'seo_admin'::app_role));

-- Allow seo_admin to manage site settings (for SEO keys)
CREATE POLICY "SEO admins can manage site settings"
ON public.site_settings
FOR ALL
USING (has_role(auth.uid(), 'seo_admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'seo_admin'::app_role));
