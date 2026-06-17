-- Moderators can manage products in the admin UI (role_permissions) but RLS was admin-only.
-- Also allow moderator uploads to the product-images storage bucket.

CREATE OR REPLACE FUNCTION public.is_admin_or_moderator(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin'::app_role, 'moderator'::app_role)
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_or_moderator(uuid) TO authenticated;

-- products: staff can read inactive rows, create, and update (delete stays admin-only)
DROP POLICY IF EXISTS "Staff can view all products" ON public.products;
CREATE POLICY "Staff can view all products"
  ON public.products
  FOR SELECT
  TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "Staff can insert products" ON public.products;
CREATE POLICY "Staff can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin_or_moderator(auth.uid()));

DROP POLICY IF EXISTS "Staff can update products" ON public.products;
CREATE POLICY "Staff can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING (public.is_admin_or_moderator(auth.uid()))
  WITH CHECK (public.is_admin_or_moderator(auth.uid()));

-- product-images storage: allow moderators (not only admins)
DROP POLICY IF EXISTS "Staff can upload product images" ON storage.objects;
CREATE POLICY "Staff can upload product images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'product-images'
    AND public.is_admin_or_moderator(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can update product images" ON storage.objects;
CREATE POLICY "Staff can update product images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin_or_moderator(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can delete product images" ON storage.objects;
CREATE POLICY "Staff can delete product images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'product-images'
    AND public.is_admin_or_moderator(auth.uid())
  );
