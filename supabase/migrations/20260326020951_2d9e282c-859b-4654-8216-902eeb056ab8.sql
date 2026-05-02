
-- Create adoption transfer history table
CREATE TABLE public.adoption_transfer_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  adoption_id uuid NOT NULL REFERENCES public.pet_adoptions(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid NOT NULL,
  details text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.adoption_transfer_history ENABLE ROW LEVEL SECURITY;

-- Policies: owner and adopter can view history for their adoptions
CREATE POLICY "Users can view related transfer history" ON public.adoption_transfer_history
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_adoptions pa
      WHERE pa.id = adoption_transfer_history.adoption_id
      AND (pa.owner_id = auth.uid() OR pa.adopter_id = auth.uid())
    )
  );

-- Admins full access
CREATE POLICY "Admins can manage transfer history" ON public.adoption_transfer_history
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Authenticated users can insert (controlled by app logic)
CREATE POLICY "Authenticated can insert transfer history" ON public.adoption_transfer_history
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = actor_id);
