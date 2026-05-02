
-- Fix: Allow authenticated users to request adoption on available listings
-- The current policy only allows owner or adopter to update, but when requesting
-- adoption the adopter_id is still NULL so the requester can't match.

-- Drop and recreate the update policy
DROP POLICY IF EXISTS "Owners can update adoption listings" ON public.pet_adoptions;

-- Allow owner, current adopter, OR any authenticated user if listing is available (for adoption requests)
CREATE POLICY "Users can update adoption listings"
ON public.pet_adoptions
FOR UPDATE
TO public
USING (
  auth.uid() = owner_id
  OR auth.uid() = adopter_id
  OR (status = 'available' AND adopter_id IS NULL)
)
WITH CHECK (
  auth.uid() = owner_id
  OR auth.uid() = adopter_id
  OR (status = 'pending' AND adopter_id = auth.uid())
);
