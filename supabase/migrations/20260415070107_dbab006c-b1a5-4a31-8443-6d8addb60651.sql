CREATE POLICY "Anyone can view pets listed for adoption"
ON public.pets FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.pet_adoptions pa
    WHERE pa.pet_id = pets.id
      AND pa.status = 'available'
      AND pa.admin_approved = true
  )
);