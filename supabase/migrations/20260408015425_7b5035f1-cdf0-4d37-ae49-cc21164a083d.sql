
-- Insert blog and seo resource permissions for all three roles
INSERT INTO public.role_permissions (role, resource, can_view, can_create, can_edit, can_delete)
VALUES
  ('admin', 'blog', true, true, true, true),
  ('admin', 'seo', true, true, true, true),
  ('moderator', 'blog', false, false, false, false),
  ('moderator', 'seo', false, false, false, false),
  ('user', 'blog', false, false, false, false),
  ('user', 'seo', false, false, false, false)
ON CONFLICT DO NOTHING;
