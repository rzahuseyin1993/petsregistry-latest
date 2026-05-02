
-- Add attachment_urls column to admin_messages for file/image attachments
ALTER TABLE public.admin_messages ADD COLUMN attachment_urls jsonb DEFAULT '[]'::jsonb;

-- Add is_html column to support HTML-formatted messages
ALTER TABLE public.admin_messages ADD COLUMN is_html boolean NOT NULL DEFAULT false;

-- Create storage bucket for admin message attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('admin-attachments', 'admin-attachments', true);

-- RLS for admin-attachments bucket: admins can upload
CREATE POLICY "Admins can upload attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'admin-attachments' AND public.has_role(auth.uid(), 'admin'));

-- Anyone can view attachments (since messages are sent to users)
CREATE POLICY "Anyone can view admin attachments" ON storage.objects FOR SELECT USING (bucket_id = 'admin-attachments');

-- Admins can delete attachments
CREATE POLICY "Admins can delete attachments" ON storage.objects FOR DELETE USING (bucket_id = 'admin-attachments' AND public.has_role(auth.uid(), 'admin'));
