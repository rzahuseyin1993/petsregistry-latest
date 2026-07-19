-- Atomic, price-authoritative store checkout.
-- The old client flow inserted an order with client-supplied prices, then
-- deducted stock in a separate call (GREATEST(stock-qty,0)), so a user could:
--   * edit localStorage to pay any price, and
--   * oversell / race concurrent checkouts.
-- This function recomputes prices from the products table, verifies stock under a
-- row lock, and creates the order + items + stock deduction in one transaction.
CREATE OR REPLACE FUNCTION public.place_store_order(_items jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _item jsonb;
  _pid uuid;
  _qty integer;
  _price numeric;
  _stock integer;
  _name text;
  _active boolean;
  _total numeric := 0;
  _order_id uuid;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;

  IF _items IS NULL OR jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN
    RAISE EXCEPTION 'Your cart is empty';
  END IF;

  -- Create the order shell first so we have an id for the items
  INSERT INTO public.orders (user_id, total, status, payment_method)
  VALUES (_uid, 0, 'pending', 'pending')
  RETURNING id INTO _order_id;

  FOR _item IN SELECT * FROM jsonb_array_elements(_items)
  LOOP
    _pid := (_item->>'product_id')::uuid;
    _qty := COALESCE((_item->>'quantity')::integer, 0);

    IF _qty < 1 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    -- Lock the product row to prevent concurrent oversell
    SELECT price, stock, name, active
      INTO _price, _stock, _name, _active
    FROM public.products
    WHERE id = _pid
    FOR UPDATE;

    IF _price IS NULL THEN
      RAISE EXCEPTION 'A product in your cart is no longer available';
    END IF;
    IF NOT _active THEN
      RAISE EXCEPTION '% is no longer available', _name;
    END IF;
    IF _stock < _qty THEN
      RAISE EXCEPTION 'Not enough stock for % (only % left)', _name, _stock;
    END IF;

    UPDATE public.products
    SET stock = stock - _qty, updated_at = now()
    WHERE id = _pid;

    INSERT INTO public.order_items (order_id, product_id, quantity, price)
    VALUES (_order_id, _pid, _qty, _price);

    _total := _total + (_price * _qty);
  END LOOP;

  UPDATE public.orders SET total = _total WHERE id = _order_id;

  RETURN jsonb_build_object('order_id', _order_id, 'total', _total);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.place_store_order(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.place_store_order(jsonb) TO authenticated;
