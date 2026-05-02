CREATE TABLE public.flyer_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  payment_id text,
  status text NOT NULL DEFAULT 'active'
);

ALTER TABLE public.flyer_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own flyer subscriptions" ON public.flyer_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all flyer subscriptions" ON public.flyer_subscriptions
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service can insert flyer subscriptions" ON public.flyer_subscriptions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);