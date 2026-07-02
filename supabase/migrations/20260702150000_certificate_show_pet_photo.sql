-- Optional pet photo on certificates: user can toggle whether the pet's
-- photo appears (top-right) on the certificate preview / PDF.
ALTER TABLE public.pet_certificates
  ADD COLUMN IF NOT EXISTS show_pet_photo boolean NOT NULL DEFAULT false;
