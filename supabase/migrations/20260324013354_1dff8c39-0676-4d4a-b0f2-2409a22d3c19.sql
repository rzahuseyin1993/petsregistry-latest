CREATE OR REPLACE FUNCTION public.deduct_stock(_product_id uuid, _quantity integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.products
  SET stock = GREATEST(stock - _quantity, 0),
      updated_at = now()
  WHERE id = _product_id;
END;
$$;