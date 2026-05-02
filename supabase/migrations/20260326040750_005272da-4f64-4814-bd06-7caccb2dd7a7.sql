
CREATE POLICY "Users can delete own unpaid certificates" ON public.pet_certificates FOR DELETE USING (auth.uid() = user_id AND is_paid = false);
