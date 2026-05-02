DROP VIEW IF EXISTS public.pets_public;
CREATE VIEW public.pets_public AS
SELECT id, owner_id, name, species, breed, age, color, weight, pet_code, status, created_at, updated_at
FROM pets;