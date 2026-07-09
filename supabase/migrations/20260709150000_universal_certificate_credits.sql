-- Universal certificate credits: one credit works for ownership OR birth certificates.

-- Merge typed pools into the single `credits` column.
UPDATE public.certificate_credits
SET credits = GREATEST(
      COALESCE(credits, 0) + COALESCE(ownership_credits, 0) + COALESCE(birth_credits, 0),
      0
    ),
    ownership_credits = 0,
    birth_credits = 0;

DROP TRIGGER IF EXISTS trg_sync_certificate_credits_total ON public.certificate_credits;

-- Map product type + pack quantity → universal credit count.
CREATE OR REPLACE FUNCTION public.certificate_credit_product_amount(
  _credit_type text,
  _quantity integer DEFAULT 1
)
RETURNS integer
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  qty integer := GREATEST(COALESCE(_quantity, 1), 1);
BEGIN
  CASE COALESCE(_credit_type, 'ownership')
    WHEN 'bundle' THEN RETURN qty * 2;
    WHEN 'ownership_pack_10', 'birth_pack_10', 'reseller_mixed_pack_10' THEN RETURN 10 * qty;
    ELSE RETURN qty;
  END CASE;
END;
$$;

-- Grant universal credits (ownership_credits / birth_credits columns kept for legacy reads, always 0).
CREATE OR REPLACE FUNCTION public.grant_certificate_credit(
  _user_id uuid,
  _amount integer DEFAULT 0,
  _is_purchase boolean DEFAULT true,
  _credit_type text DEFAULT 'ownership'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt integer;
BEGIN
  amt := public.certificate_credit_product_amount(_credit_type, _amount);
  IF amt <= 0 THEN RETURN; END IF;

  INSERT INTO public.certificate_credits (user_id, credits, lifetime_purchased)
  VALUES (_user_id, amt, CASE WHEN _is_purchase THEN amt ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
  SET
    credits = public.certificate_credits.credits + amt,
    lifetime_purchased = public.certificate_credits.lifetime_purchased
      + CASE WHEN _is_purchase THEN amt ELSE 0 END,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.grant_certificate_credits_typed(
  _user_id uuid,
  _ownership_amount integer DEFAULT 0,
  _birth_amount integer DEFAULT 0,
  _is_purchase boolean DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  amt integer := GREATEST(COALESCE(_ownership_amount, 0), 0) + GREATEST(COALESCE(_birth_amount, 0), 0);
BEGIN
  IF amt <= 0 THEN RETURN; END IF;

  INSERT INTO public.certificate_credits (user_id, credits, lifetime_purchased)
  VALUES (_user_id, amt, CASE WHEN _is_purchase THEN amt ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
  SET
    credits = public.certificate_credits.credits + amt,
    lifetime_purchased = public.certificate_credits.lifetime_purchased
      + CASE WHEN _is_purchase THEN amt ELSE 0 END,
    updated_at = now();
END;
$$;

-- Consume one universal credit (_credit_type ignored; kept for API compatibility).
CREATE OR REPLACE FUNCTION public.consume_certificate_credit(
  _user_id uuid,
  _credit_type text DEFAULT 'ownership'
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN false;
  END IF;

  SELECT credits INTO current_credits
  FROM public.certificate_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF current_credits IS NULL OR current_credits <= 0 THEN
    RETURN false;
  END IF;

  UPDATE public.certificate_credits
  SET credits = credits - 1, updated_at = now()
  WHERE user_id = _user_id;

  RETURN true;
END;
$$;

-- Atomic deduction on issue (single source of truth — no double-spend with RPC).
CREATE OR REPLACE FUNCTION public.enforce_certificate_credit_on_pay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  IF NEW.is_paid = true
     AND (OLD.is_paid IS DISTINCT FROM true)
     AND COALESCE(NEW.payment_id, '') LIKE 'cert_credit_%' THEN

    SELECT credits INTO current_credits
    FROM public.certificate_credits
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits <= 0 THEN
      RAISE EXCEPTION 'No certificate credits available' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.certificate_credits
    SET credits = credits - 1, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Free member credit → 1 universal credit.
CREATE OR REPLACE FUNCTION public.claim_free_certificate_credit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_active_membership boolean;
  already_claimed boolean;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN false;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM public.memberships
    WHERE user_id = _user_id AND status = 'active' AND expires_at > now()
  ) INTO has_active_membership;

  IF NOT has_active_membership THEN
    RETURN false;
  END IF;

  INSERT INTO public.certificate_credits (user_id, credits, free_credit_claimed)
  VALUES (_user_id, 1, true)
  ON CONFLICT (user_id) DO UPDATE
  SET
    credits = CASE
      WHEN public.certificate_credits.free_credit_claimed THEN public.certificate_credits.credits
      ELSE public.certificate_credits.credits + 1
    END,
    free_credit_claimed = true,
    updated_at = now()
  WHERE public.certificate_credits.free_credit_claimed = false;

  SELECT free_credit_claimed INTO already_claimed
  FROM public.certificate_credits WHERE user_id = _user_id;

  RETURN already_claimed;
END;
$$;

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
  universal_qty integer;
BEGIN
  SELECT * INTO ord
  FROM public.certificate_credit_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF ord.credits_granted THEN RETURN true; END IF;

  universal_qty := GREATEST(COALESCE(ord.ownership_qty, 0) + COALESCE(ord.birth_qty, 0), 0);

  IF universal_qty <= 0 THEN
    universal_qty := public.certificate_credit_product_amount(ord.credit_type, ord.quantity);
  END IF;

  UPDATE public.certificate_credit_orders
  SET
    status = 'paid',
    payment_id = COALESCE(NULLIF(_payment_id, ''), payment_id),
    payment_method = COALESCE(NULLIF(_payment_method, ''), payment_method),
    credits_granted = true,
    quantity = universal_qty,
    ownership_qty = 0,
    birth_qty = 0,
    updated_at = now()
  WHERE id = _order_id;

  IF universal_qty > 0 THEN
    INSERT INTO public.certificate_credits (user_id, credits, lifetime_purchased)
    VALUES (ord.user_id, universal_qty, universal_qty)
    ON CONFLICT (user_id) DO UPDATE
    SET
      credits = public.certificate_credits.credits + universal_qty,
      lifetime_purchased = public.certificate_credits.lifetime_purchased + universal_qty,
      updated_at = now();
  END IF;

  RETURN true;
END;
$$;
