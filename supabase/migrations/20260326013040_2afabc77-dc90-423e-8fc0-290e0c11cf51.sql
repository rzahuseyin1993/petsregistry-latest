
-- RPC to search pets by microchip number without exposing the value
CREATE OR REPLACE FUNCTION public.search_pet_by_microchip(_chip text)
RETURNS TABLE(id uuid)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id
  FROM public.pets p
  WHERE p.microchip_number ILIKE '%' || _chip || '%'
$$;
