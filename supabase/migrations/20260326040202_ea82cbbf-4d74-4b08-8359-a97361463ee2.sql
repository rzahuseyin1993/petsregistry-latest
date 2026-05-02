
-- Storage bucket for certificate backgrounds
INSERT INTO storage.buckets (id, name, public) VALUES ('certificate-backgrounds', 'certificate-backgrounds', true) ON CONFLICT DO NOTHING;

-- Storage policies
CREATE POLICY "Anyone can view certificate backgrounds" ON storage.objects FOR SELECT USING (bucket_id = 'certificate-backgrounds');
CREATE POLICY "Admins can upload certificate backgrounds" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'certificate-backgrounds' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete certificate backgrounds" ON storage.objects FOR DELETE USING (bucket_id = 'certificate-backgrounds' AND public.has_role(auth.uid(), 'admin'));
