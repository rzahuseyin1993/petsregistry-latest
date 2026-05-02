ALTER TABLE public.business_listings 
  ADD COLUMN lat numeric DEFAULT NULL,
  ADD COLUMN lng numeric DEFAULT NULL;