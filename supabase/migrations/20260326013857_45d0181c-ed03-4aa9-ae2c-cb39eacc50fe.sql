
-- Role permissions table: stores page + action permissions per role
CREATE TABLE public.role_permissions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role NOT NULL,
  resource text NOT NULL,       -- e.g. 'dashboard', 'members', 'pets', 'orders'
  can_view boolean NOT NULL DEFAULT false,
  can_create boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  can_delete boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, resource)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage permissions
CREATE POLICY "Admins can manage permissions" ON public.role_permissions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Authenticated users can read permissions (needed to check own role's perms)
CREATE POLICY "Authenticated can view permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_role_permissions_updated_at
  BEFORE UPDATE ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed default permissions for all roles and resources
-- Admin gets full access, Moderator gets view + limited edit, User gets nothing
INSERT INTO public.role_permissions (role, resource, can_view, can_create, can_edit, can_delete) VALUES
  -- Admin: full access to everything
  ('admin', 'dashboard', true, true, true, true),
  ('admin', 'members', true, true, true, true),
  ('admin', 'pets', true, true, true, true),
  ('admin', 'orders', true, true, true, true),
  ('admin', 'products', true, true, true, true),
  ('admin', 'memberships', true, true, true, true),
  ('admin', 'donations', true, true, true, true),
  ('admin', 'directory', true, true, true, true),
  ('admin', 'lost_reports', true, true, true, true),
  ('admin', 'contacts', true, true, true, true),
  ('admin', 'flyer_templates', true, true, true, true),
  ('admin', 'page_builder', true, true, true, true),
  ('admin', 'payments', true, true, true, true),
  ('admin', 'settings', true, true, true, true),
  ('admin', 'permissions', true, true, true, true),
  -- Moderator: view most, edit some, no delete/payments/settings
  ('moderator', 'dashboard', true, false, false, false),
  ('moderator', 'members', true, false, true, false),
  ('moderator', 'pets', true, true, true, false),
  ('moderator', 'orders', true, false, true, false),
  ('moderator', 'products', true, true, true, false),
  ('moderator', 'memberships', true, false, false, false),
  ('moderator', 'donations', true, false, false, false),
  ('moderator', 'directory', true, false, true, false),
  ('moderator', 'lost_reports', true, false, true, false),
  ('moderator', 'contacts', true, false, true, false),
  ('moderator', 'flyer_templates', true, true, true, false),
  ('moderator', 'page_builder', false, false, false, false),
  ('moderator', 'payments', false, false, false, false),
  ('moderator', 'settings', false, false, false, false),
  ('moderator', 'permissions', false, false, false, false),
  -- User: no admin access by default
  ('user', 'dashboard', false, false, false, false),
  ('user', 'members', false, false, false, false),
  ('user', 'pets', false, false, false, false),
  ('user', 'orders', false, false, false, false),
  ('user', 'products', false, false, false, false),
  ('user', 'memberships', false, false, false, false),
  ('user', 'donations', false, false, false, false),
  ('user', 'directory', false, false, false, false),
  ('user', 'lost_reports', false, false, false, false),
  ('user', 'contacts', false, false, false, false),
  ('user', 'flyer_templates', false, false, false, false),
  ('user', 'page_builder', false, false, false, false),
  ('user', 'payments', false, false, false, false),
  ('user', 'settings', false, false, false, false),
  ('user', 'permissions', false, false, false, false);
