-- Certificate numbers use the pet's Pet ID (pet_code) automatically for verification.
CREATE OR REPLACE FUNCTION public.assign_certificate_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  pet_code_val text;
BEGIN
  IF NEW.is_paid = true AND (OLD.is_paid IS DISTINCT FROM true OR NEW.certificate_number IS NULL) THEN
    IF NEW.certificate_number IS NULL THEN
      SELECT p.pet_code INTO pet_code_val
      FROM public.pets p
      WHERE p.id = NEW.pet_id;

      IF pet_code_val IS NOT NULL AND btrim(pet_code_val) <> '' THEN
        NEW.certificate_number := btrim(pet_code_val);
      ELSE
        NEW.certificate_number := 'CERT-' || LPAD(nextval('public.certificate_number_seq')::text, 6, '0');
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

-- Align existing paid certificates with their Pet ID where possible.
UPDATE public.pet_certificates pc
SET certificate_number = p.pet_code
FROM public.pets p
WHERE pc.pet_id = p.id
  AND pc.is_paid = true
  AND p.pet_code IS NOT NULL
  AND btrim(p.pet_code) <> ''
  AND (
    pc.certificate_number IS NULL
    OR pc.certificate_number LIKE 'CERT-%'
  );
