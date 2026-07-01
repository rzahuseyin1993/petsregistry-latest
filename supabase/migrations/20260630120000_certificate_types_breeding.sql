-- Phase 1–3: Ownership + Birth certificates, breeding fields, typed credits, litters, reseller packs

-- ── Pet breeding / birth fields ─────────────────────────────────────────────
ALTER TABLE public.pets
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS sex text,
  ADD COLUMN IF NOT EXISTS birth_location text,
  ADD COLUMN IF NOT EXISTS birth_weight text,
  ADD COLUMN IF NOT EXISTS birth_height text,
  ADD COLUMN IF NOT EXISTS eye_color text,
  ADD COLUMN IF NOT EXISTS breeder_name text,
  ADD COLUMN IF NOT EXISTS sire_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS dam_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sire_name text,
  ADD COLUMN IF NOT EXISTS dam_name text,
  ADD COLUMN IF NOT EXISTS sire_photo_url text,
  ADD COLUMN IF NOT EXISTS dam_photo_url text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_certificate_reseller boolean NOT NULL DEFAULT false;

-- ── Certificate type + print-on-behalf ────────────────────────────────────
ALTER TABLE public.pet_certificates
  ADD COLUMN IF NOT EXISTS certificate_type text NOT NULL DEFAULT 'ownership',
  ADD COLUMN IF NOT EXISTS issued_for_name text,
  ADD COLUMN IF NOT EXISTS issued_for_email text;

ALTER TABLE public.pet_certificates
  DROP CONSTRAINT IF EXISTS pet_certificates_certificate_type_check;

ALTER TABLE public.pet_certificates
  ADD CONSTRAINT pet_certificates_certificate_type_check
  CHECK (certificate_type IN ('ownership', 'birth'));

-- One active cert per pet per type (drafts included)
CREATE UNIQUE INDEX IF NOT EXISTS pet_certificates_pet_type_unique
  ON public.pet_certificates (pet_id, certificate_type);

-- ── Typed credits ───────────────────────────────────────────────────────────
ALTER TABLE public.certificate_credits
  ADD COLUMN IF NOT EXISTS ownership_credits integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS birth_credits integer NOT NULL DEFAULT 0;

UPDATE public.certificate_credits
SET ownership_credits = GREATEST(credits, 0)
WHERE ownership_credits = 0 AND credits > 0;

-- Keep legacy `credits` in sync as total (for older code paths)
CREATE OR REPLACE FUNCTION public.sync_certificate_credits_total()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.credits := COALESCE(NEW.ownership_credits, 0) + COALESCE(NEW.birth_credits, 0);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_certificate_credits_total ON public.certificate_credits;
CREATE TRIGGER trg_sync_certificate_credits_total
  BEFORE INSERT OR UPDATE OF ownership_credits, birth_credits ON public.certificate_credits
  FOR EACH ROW EXECUTE FUNCTION public.sync_certificate_credits_total();

UPDATE public.certificate_credits
SET ownership_credits = COALESCE(ownership_credits, 0),
    birth_credits = COALESCE(birth_credits, 0);

-- ── Credit orders: product type ─────────────────────────────────────────────
ALTER TABLE public.certificate_credit_orders
  ADD COLUMN IF NOT EXISTS credit_type text NOT NULL DEFAULT 'ownership',
  ADD COLUMN IF NOT EXISTS ownership_qty integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS birth_qty integer NOT NULL DEFAULT 0;

ALTER TABLE public.certificate_credit_orders
  DROP CONSTRAINT IF EXISTS certificate_credit_orders_credit_type_check;

ALTER TABLE public.certificate_credit_orders
  ADD CONSTRAINT certificate_credit_orders_credit_type_check
  CHECK (credit_type IN (
    'ownership', 'birth', 'bundle',
    'ownership_pack_10', 'birth_pack_10', 'reseller_mixed_pack_10'
  ));

UPDATE public.certificate_credit_orders
SET ownership_qty = quantity,
    birth_qty = 0,
    credit_type = 'ownership'
WHERE ownership_qty = 0 AND birth_qty = 0 AND quantity > 0;

-- ── Litter registration ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.pet_litters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sire_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  dam_pet_id uuid REFERENCES public.pets(id) ON DELETE SET NULL,
  sire_name text,
  dam_name text,
  litter_date date,
  birth_location text,
  breeder_name text,
  puppy_count integer NOT NULL DEFAULT 1 CHECK (puppy_count > 0 AND puppy_count <= 20),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pet_litters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own litters"
  ON public.pet_litters FOR ALL
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_pet_litters_updated_at
  BEFORE UPDATE ON public.pet_litters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── Pricing site settings ─────────────────────────────────────────────────────
INSERT INTO public.site_settings (key, value) VALUES
  ('service_price_certificate_ownership', '15'),
  ('service_price_certificate_birth', '15'),
  ('service_price_certificate_bundle', '30'),
  ('service_price_certificate_ownership_pack_10', '120'),
  ('service_price_certificate_birth_pack_10', '120'),
  ('service_price_certificate_reseller_mixed_pack_10', '120')
ON CONFLICT (key) DO NOTHING;

-- ── Certificate numbers per type ────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.assign_certificate_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pet_code_val text;
  suffix text;
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS DISTINCT FROM true OR NEW.certificate_number IS NULL) THEN
    IF NEW.certificate_number IS NULL THEN
      SELECT p.pet_code INTO pet_code_val
      FROM public.pets p
      WHERE p.id = NEW.pet_id;

      suffix := CASE COALESCE(NEW.certificate_type, 'ownership')
        WHEN 'birth' THEN '-BIRTH'
        ELSE '-OWN'
      END;

      IF pet_code_val IS NOT NULL AND btrim(pet_code_val) <> '' THEN
        NEW.certificate_number := btrim(pet_code_val) || suffix;
      ELSE
        NEW.certificate_number := 'CERT-' || LPAD(nextval('public.certificate_number_seq')::text, 6, '0') || suffix;
      END IF;
    END IF;

    IF NEW.verification_code IS NULL THEN
      NEW.verification_code := encode(gen_random_bytes(8), 'hex');
    END IF;

    IF NEW.issued_at IS NULL THEN
      NEW.issued_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Typed credit consumption on pay ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enforce_certificate_credit_on_pay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  ctype text;
  o_credits integer;
  b_credits integer;
BEGIN
  IF NEW.is_paid = true
     AND (OLD.is_paid IS DISTINCT FROM true)
     AND COALESCE(NEW.payment_id, '') LIKE 'cert_credit_%' THEN

    ctype := COALESCE(NEW.certificate_type, 'ownership');

    SELECT ownership_credits, birth_credits
    INTO o_credits, b_credits
    FROM public.certificate_credits
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    IF ctype = 'birth' THEN
      IF b_credits IS NULL OR b_credits <= 0 THEN
        RAISE EXCEPTION 'No birth certificate credits available' USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.certificate_credits
      SET birth_credits = birth_credits - 1, updated_at = now()
      WHERE user_id = NEW.user_id;
    ELSE
      IF o_credits IS NULL OR o_credits <= 0 THEN
        RAISE EXCEPTION 'No ownership certificate credits available' USING ERRCODE = 'P0001';
      END IF;
      UPDATE public.certificate_credits
      SET ownership_credits = ownership_credits - 1, updated_at = now()
      WHERE user_id = NEW.user_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Grant typed credits ─────────────────────────────────────────────────────
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
  o_amt integer := 0;
  b_amt integer := 0;
BEGIN
  CASE _credit_type
    WHEN 'birth' THEN b_amt := GREATEST(_amount, 0);
    WHEN 'bundle' THEN
      o_amt := GREATEST(_amount, 0);
      b_amt := GREATEST(_amount, 0);
    WHEN 'ownership_pack_10' THEN o_amt := GREATEST(_amount, 0);
    WHEN 'ownership' THEN o_amt := GREATEST(_amount, 0);
    WHEN 'birth_pack_10' THEN b_amt := GREATEST(_amount, 0);
    WHEN 'reseller_mixed_pack_10' THEN
      o_amt := GREATEST(_amount, 0);
      b_amt := GREATEST(_amount, 0);
    ELSE o_amt := GREATEST(_amount, 0);
  END CASE;

  INSERT INTO public.certificate_credits (user_id, ownership_credits, birth_credits, lifetime_purchased)
  VALUES (
    _user_id,
    o_amt,
    b_amt,
    CASE WHEN _is_purchase THEN o_amt + b_amt ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    ownership_credits = public.certificate_credits.ownership_credits + o_amt,
    birth_credits = public.certificate_credits.birth_credits + b_amt,
    lifetime_purchased = public.certificate_credits.lifetime_purchased
      + CASE WHEN _is_purchase THEN o_amt + b_amt ELSE 0 END,
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
BEGIN
  INSERT INTO public.certificate_credits (user_id, ownership_credits, birth_credits, lifetime_purchased)
  VALUES (
    _user_id,
    GREATEST(_ownership_amount, 0),
    GREATEST(_birth_amount, 0),
    CASE WHEN _is_purchase THEN GREATEST(_ownership_amount, 0) + GREATEST(_birth_amount, 0) ELSE 0 END
  )
  ON CONFLICT (user_id) DO UPDATE
  SET
    ownership_credits = public.certificate_credits.ownership_credits + GREATEST(_ownership_amount, 0),
    birth_credits = public.certificate_credits.birth_credits + GREATEST(_birth_amount, 0),
    lifetime_purchased = public.certificate_credits.lifetime_purchased
      + CASE WHEN _is_purchase THEN GREATEST(_ownership_amount, 0) + GREATEST(_birth_amount, 0) ELSE 0 END,
    updated_at = now();
END;
$$;

-- ── Consume typed credit (RPC from frontend) ──────────────────────────────────
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
  o_credits integer;
  b_credits integer;
BEGIN
  IF _user_id IS NULL OR _user_id <> auth.uid() THEN
    RETURN false;
  END IF;

  SELECT ownership_credits, birth_credits
  INTO o_credits, b_credits
  FROM public.certificate_credits
  WHERE user_id = _user_id
  FOR UPDATE;

  IF _credit_type = 'birth' THEN
    IF b_credits IS NULL OR b_credits <= 0 THEN RETURN false; END IF;
    UPDATE public.certificate_credits
    SET birth_credits = birth_credits - 1, updated_at = now()
    WHERE user_id = _user_id;
  ELSE
    IF o_credits IS NULL OR o_credits <= 0 THEN RETURN false; END IF;
    UPDATE public.certificate_credits
    SET ownership_credits = ownership_credits - 1, updated_at = now()
    WHERE user_id = _user_id;
  END IF;

  RETURN true;
END;
$$;

-- Free member credit = 1 ownership credit
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

  INSERT INTO public.certificate_credits (user_id, ownership_credits, free_credit_claimed)
  VALUES (_user_id, 1, true)
  ON CONFLICT (user_id) DO UPDATE
  SET
    ownership_credits = CASE
      WHEN public.certificate_credits.free_credit_claimed THEN public.certificate_credits.ownership_credits
      ELSE public.certificate_credits.ownership_credits + 1
    END,
    free_credit_claimed = true,
    updated_at = now()
  WHERE public.certificate_credits.free_credit_claimed = false;

  SELECT free_credit_claimed INTO already_claimed
  FROM public.certificate_credits WHERE user_id = _user_id;

  RETURN already_claimed;
END;
$$;

-- ── Fulfill orders with typed credits ───────────────────────────────────────
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
  o_qty integer;
  b_qty integer;
BEGIN
  SELECT * INTO ord
  FROM public.certificate_credit_orders
  WHERE id = _order_id
  FOR UPDATE;

  IF NOT FOUND THEN RETURN false; END IF;
  IF ord.credits_granted THEN RETURN true; END IF;

  o_qty := COALESCE(ord.ownership_qty, 0);
  b_qty := COALESCE(ord.birth_qty, 0);

  IF o_qty = 0 AND b_qty = 0 THEN
    CASE ord.credit_type
      WHEN 'birth', 'birth_pack_10' THEN
        b_qty := ord.quantity;
      WHEN 'bundle' THEN
        o_qty := ord.quantity;
        b_qty := ord.quantity;
      WHEN 'reseller_mixed_pack_10' THEN
        o_qty := 5;
        b_qty := 5;
      ELSE
        o_qty := ord.quantity;
    END CASE;
  END IF;

  UPDATE public.certificate_credit_orders
  SET
    status = 'paid',
    payment_id = COALESCE(NULLIF(_payment_id, ''), payment_id),
    payment_method = COALESCE(NULLIF(_payment_method, ''), payment_method),
    credits_granted = true,
    ownership_qty = o_qty,
    birth_qty = b_qty,
    updated_at = now()
  WHERE id = _order_id;

  PERFORM public.grant_certificate_credits_typed(ord.user_id, o_qty, b_qty, true);

  RETURN true;
END;
$$;

-- ── Public verification view ────────────────────────────────────────────────
-- Must DROP first: CREATE OR REPLACE cannot insert/reorder columns on an existing view.
DROP VIEW IF EXISTS public.certificate_verification;

CREATE VIEW public.certificate_verification AS
SELECT
  pc.id,
  pc.certificate_number,
  pc.verification_code,
  pc.certificate_type,
  pc.issued_at,
  pc.is_paid,
  pc.issued_for_name,
  p.name AS pet_name,
  p.species,
  p.breed,
  p.pet_code,
  p.date_of_birth,
  p.sex,
  p.birth_location,
  p.birth_weight,
  p.birth_height,
  p.eye_color,
  p.color AS fur_color,
  p.breeder_name,
  COALESCE(sire.name, p.sire_name) AS sire_name,
  COALESCE(dam.name, p.dam_name) AS dam_name,
  p.sire_photo_url,
  p.dam_photo_url
FROM public.pet_certificates pc
JOIN public.pets p ON p.id = pc.pet_id
LEFT JOIN public.pets sire ON sire.id = p.sire_pet_id
LEFT JOIN public.pets dam ON dam.id = p.dam_pet_id
WHERE pc.is_paid = true AND pc.certificate_number IS NOT NULL;

GRANT SELECT ON public.certificate_verification TO anon, authenticated;
