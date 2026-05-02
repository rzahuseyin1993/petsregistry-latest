-- Add pet_code column
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS pet_code text UNIQUE;

-- Create sequence for running number
CREATE SEQUENCE IF NOT EXISTS public.pet_code_seq START WITH 100001;

-- Set existing pets' pet_code based on creation order
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at) + 100000 AS num,
         EXTRACT(YEAR FROM created_at)::int AS yr
  FROM public.pets
  WHERE pet_code IS NULL
)
UPDATE public.pets SET pet_code = 'PR-' || numbered.yr || '-' || numbered.num
FROM numbered WHERE pets.id = numbered.id;

-- Advance sequence past existing pets
SELECT setval('public.pet_code_seq', GREATEST(
  (SELECT COALESCE(MAX(CAST(SPLIT_PART(pet_code, '-', 3) AS bigint)), 100000) FROM public.pets),
  100000
));

-- Create trigger function to auto-generate pet_code
CREATE OR REPLACE FUNCTION public.generate_pet_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = 'public'
AS $$
BEGIN
  IF NEW.pet_code IS NULL OR NEW.pet_code = '' THEN
    NEW.pet_code := 'PR-' || EXTRACT(YEAR FROM now())::int || '-' || nextval('public.pet_code_seq');
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_pet_code ON public.pets;
CREATE TRIGGER trg_generate_pet_code
  BEFORE INSERT ON public.pets
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_pet_code();

-- Add admin_approved column to pet_adoptions for approval workflow
ALTER TABLE public.pet_adoptions ADD COLUMN IF NOT EXISTS admin_approved boolean NOT NULL DEFAULT false;