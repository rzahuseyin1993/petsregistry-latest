-- Pending / completed certificate credit purchases (payment → credits fulfillment)
CREATE TABLE IF NOT EXISTS public.certificate_credit_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  unit_price numeric NOT NULL,
  total numeric NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'cancelled', 'failed')),
  payment_id text,
  payment_method text,
  credits_granted boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificate_credit_orders_user
  ON public.certificate_credit_orders (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_certificate_credit_orders_payment
  ON public.certificate_credit_orders (payment_id)
  WHERE payment_id IS NOT NULL;

ALTER TABLE public.certificate_credit_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own certificate credit orders"
  ON public.certificate_credit_orders FOR SELECT
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage certificate credit orders"
  ON public.certificate_credit_orders FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_certificate_credit_orders_updated_at
  BEFORE UPDATE ON public.certificate_credit_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Idempotent: mark order paid and grant credits once
CREATE OR REPLACE FUNCTION public.fulfill_certificate_credit_order(
  _order_id uuid,
  _payment_id text DEFAULT NULL,
  _payment_method text DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ord public.certificate_credit_orders%ROWTYPE;
BEGIN
  SELECT * INTO ord
  FROM public.certificate_credit_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF ord.credits_granted THEN
    RETURN true;
  END IF;

  UPDATE public.certificate_credit_orders
  SET
    status = 'paid',
    payment_id = COALESCE(NULLIF(_payment_id, ''), payment_id),
    payment_method = COALESCE(NULLIF(_payment_method, ''), payment_method),
    credits_granted = true,
    updated_at = now()
  WHERE id = _order_id;

  PERFORM public.grant_certificate_credit(ord.user_id, ord.quantity, true);

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.fulfill_certificate_credit_order(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.fulfill_certificate_credit_order(uuid, text, text) TO service_role;
