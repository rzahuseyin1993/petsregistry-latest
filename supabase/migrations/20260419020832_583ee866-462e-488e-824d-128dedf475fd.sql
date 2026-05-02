-- Credits ledger per user
CREATE TABLE public.certificate_credits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  credits integer NOT NULL DEFAULT 0,
  lifetime_purchased integer NOT NULL DEFAULT 0,
  free_credit_claimed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.certificate_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own credits"
ON public.certificate_credits FOR SELECT
USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage credits"
ON public.certificate_credits FOR ALL
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert credits"
ON public.certificate_credits FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_certificate_credits_updated_at
BEFORE UPDATE ON public.certificate_credits
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Running number sequence + columns on pet_certificates
CREATE SEQUENCE IF NOT EXISTS public.certificate_number_seq START 1000;

ALTER TABLE public.pet_certificates
  ADD COLUMN IF NOT EXISTS certificate_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS verification_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS issued_at timestamptz;

-- Auto-assign certificate number + verification code when marked paid
CREATE OR REPLACE FUNCTION public.assign_certificate_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS DISTINCT FROM true OR NEW.certificate_number IS NULL) THEN
    IF NEW.certificate_number IS NULL THEN
      NEW.certificate_number := 'CERT-' || LPAD(nextval('public.certificate_number_seq')::text, 6, '0');
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

DROP TRIGGER IF EXISTS pet_certificates_assign_number ON public.pet_certificates;
CREATE TRIGGER pet_certificates_assign_number
BEFORE INSERT OR UPDATE ON public.pet_certificates
FOR EACH ROW EXECUTE FUNCTION public.assign_certificate_number();

-- Public verification view (no PII, just cert details for verification)
CREATE OR REPLACE VIEW public.certificate_verification AS
SELECT
  pc.id,
  pc.certificate_number,
  pc.verification_code,
  pc.issued_at,
  pc.is_paid,
  p.name AS pet_name,
  p.species,
  p.breed,
  p.pet_code
FROM public.pet_certificates pc
JOIN public.pets p ON p.id = pc.pet_id
WHERE pc.is_paid = true AND pc.certificate_number IS NOT NULL;

GRANT SELECT ON public.certificate_verification TO anon, authenticated;

-- Consume one credit (atomic)
CREATE OR REPLACE FUNCTION public.consume_certificate_credit(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
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

-- Grant credits (used by webhook + admin)
CREATE OR REPLACE FUNCTION public.grant_certificate_credit(_user_id uuid, _amount integer, _is_purchase boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.certificate_credits (user_id, credits, lifetime_purchased)
  VALUES (_user_id, _amount, CASE WHEN _is_purchase THEN _amount ELSE 0 END)
  ON CONFLICT (user_id) DO UPDATE
  SET credits = public.certificate_credits.credits + _amount,
      lifetime_purchased = public.certificate_credits.lifetime_purchased + CASE WHEN _is_purchase THEN _amount ELSE 0 END,
      updated_at = now();
END;
$$;

-- Claim free credit for paid members (one-time)
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
  SET credits = CASE WHEN public.certificate_credits.free_credit_claimed THEN public.certificate_credits.credits ELSE public.certificate_credits.credits + 1 END,
      free_credit_claimed = true,
      updated_at = now()
  WHERE public.certificate_credits.free_credit_claimed = false;

  SELECT free_credit_claimed INTO already_claimed
  FROM public.certificate_credits WHERE user_id = _user_id;

  RETURN already_claimed;
END;
$$;