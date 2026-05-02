
-- 1. moderation_flags: AI verdicts the admin reviews
CREATE TABLE public.moderation_flags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL, -- 'profile' | 'pet' | 'business_listing' | 'lost_report' | 'contact_submission' | 'admin_message'
  entity_id uuid NOT NULL,
  owner_user_id uuid,
  severity text NOT NULL DEFAULT 'low', -- 'low' | 'medium' | 'high'
  confidence numeric NOT NULL DEFAULT 0, -- 0..1
  reason text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  suggested_action text NOT NULL DEFAULT 'review', -- 'review' | 'pause' | 'delete'
  status text NOT NULL DEFAULT 'open', -- 'open' | 'resolved' | 'dismissed' | 'auto_paused'
  auto_paused boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_moderation_flags_status ON public.moderation_flags(status, created_at DESC);
CREATE INDEX idx_moderation_flags_entity ON public.moderation_flags(entity_type, entity_id);

ALTER TABLE public.moderation_flags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage moderation flags"
ON public.moderation_flags FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_moderation_flags_updated
BEFORE UPDATE ON public.moderation_flags
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. moderation_queue: jobs the edge function processes
CREATE TABLE public.moderation_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  owner_user_id uuid,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending', -- 'pending' | 'processed' | 'error'
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_moderation_queue_pending ON public.moderation_queue(status, created_at) WHERE status = 'pending';

ALTER TABLE public.moderation_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read moderation queue"
ON public.moderation_queue FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update moderation queue"
ON public.moderation_queue FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Add is_paused columns where missing
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.pets ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.lost_reports ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.admin_messages ADD COLUMN IF NOT EXISTS is_paused boolean NOT NULL DEFAULT false;
-- business_listings already has is_active; we'll reuse that for pausing

-- 4. Generic enqueue function
CREATE OR REPLACE FUNCTION public.enqueue_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entity_type text := TG_ARGV[0];
  v_owner uuid;
  v_payload jsonb;
BEGIN
  -- Pull owner + a JSON snapshot per table
  IF v_entity_type = 'profile' THEN
    v_owner := NEW.user_id;
    v_payload := jsonb_build_object('full_name', NEW.full_name, 'email', NEW.email, 'phone', NEW.phone, 'address', NEW.address, 'city', NEW.city, 'country', NEW.country);
  ELSIF v_entity_type = 'pet' THEN
    v_owner := NEW.owner_id;
    v_payload := jsonb_build_object('name', NEW.name, 'species', NEW.species, 'breed', NEW.breed, 'color', NEW.color, 'age', NEW.age, 'notes', NEW.notes, 'microchip_number', NEW.microchip_number);
  ELSIF v_entity_type = 'business_listing' THEN
    v_owner := NEW.owner_id;
    v_payload := jsonb_build_object('name', NEW.name, 'description', NEW.description, 'address', NEW.address, 'city', NEW.city, 'country', NEW.country, 'phone', NEW.phone, 'email', NEW.email, 'website', NEW.website);
  ELSIF v_entity_type = 'lost_report' THEN
    v_owner := NEW.reporter_id;
    v_payload := jsonb_build_object('description', NEW.description, 'last_seen_address', NEW.last_seen_address, 'reward', NEW.reward, 'contact_phone', NEW.contact_phone);
  ELSIF v_entity_type = 'contact_submission' THEN
    v_owner := NULL;
    v_payload := jsonb_build_object('name', NEW.name, 'email', NEW.email, 'subject', NEW.subject, 'message', NEW.message);
  ELSIF v_entity_type = 'admin_message' THEN
    v_owner := NEW.sender_id;
    v_payload := jsonb_build_object('subject', NEW.subject, 'message', NEW.message, 'recipient_id', NEW.recipient_id);
  END IF;

  INSERT INTO public.moderation_queue(entity_type, entity_id, owner_user_id, payload)
  VALUES (v_entity_type, NEW.id, v_owner, v_payload);

  -- Fire-and-forget HTTP call to edge function via pg_net (best-effort)
  PERFORM net.http_post(
    url := 'https://aqaausjzzkqcubgfjgnc.supabase.co/functions/v1/ai-moderation',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'auto')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block the original insert
  RETURN NEW;
END;
$$;

-- 5. Triggers (AFTER INSERT only)
CREATE TRIGGER trg_moderate_profile AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('profile');

CREATE TRIGGER trg_moderate_pet AFTER INSERT ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('pet');

CREATE TRIGGER trg_moderate_business_listing AFTER INSERT ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('business_listing');

CREATE TRIGGER trg_moderate_lost_report AFTER INSERT ON public.lost_reports
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('lost_report');

CREATE TRIGGER trg_moderate_contact AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('contact_submission');

CREATE TRIGGER trg_moderate_admin_message AFTER INSERT ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('admin_message');

-- 6. Enable pg_net for the http_post call
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
