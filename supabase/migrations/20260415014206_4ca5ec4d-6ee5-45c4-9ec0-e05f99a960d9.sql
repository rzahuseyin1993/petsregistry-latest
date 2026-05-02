
-- Add monthly pricing and Stripe price IDs to membership_plans
ALTER TABLE public.membership_plans 
  ADD COLUMN IF NOT EXISTS monthly_price numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
  ADD COLUMN IF NOT EXISTS stripe_yearly_price_id text;

-- Add billing interval and Stripe subscription fields to memberships
ALTER TABLE public.memberships
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'yearly',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;

-- Add billing interval and Stripe fields to flyer_subscriptions
ALTER TABLE public.flyer_subscriptions
  ADD COLUMN IF NOT EXISTS billing_interval text NOT NULL DEFAULT 'one_time',
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS price numeric DEFAULT 2;

-- Insert default yearly discount setting
INSERT INTO public.site_settings (key, value, description)
VALUES ('yearly_discount_percent', '20', 'Percentage discount for yearly billing vs monthly')
ON CONFLICT (key) DO NOTHING;

-- Insert default flyer monthly price setting
INSERT INTO public.site_settings (key, value, description)
VALUES ('flyer_monthly_price', '1', 'Monthly price for flyer builder access in USD')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.site_settings (key, value, description)
VALUES ('flyer_yearly_price', '10', 'Yearly price for flyer builder access in USD')
ON CONFLICT (key) DO NOTHING;
