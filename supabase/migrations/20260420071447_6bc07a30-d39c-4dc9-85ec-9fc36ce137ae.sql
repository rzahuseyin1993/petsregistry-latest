
-- ============================================================================
-- 1. ATOMIC CERTIFICATE CREDIT DEDUCTION TRIGGER
-- Prevents race conditions: when a certificate flips to is_paid=true via a
-- credit (payment_id starts with cert_credit_), require & atomically consume
-- one credit. If no credit available, RAISE EXCEPTION → certificate stays unpaid.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_certificate_credit_on_pay()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_credits integer;
BEGIN
  -- Only run when transitioning to paid via the credit flow
  IF NEW.is_paid = true
     AND (OLD.is_paid IS DISTINCT FROM true)
     AND COALESCE(NEW.payment_id, '') LIKE 'cert_credit_%' THEN

    -- Lock the row to prevent concurrent double-spend
    SELECT credits INTO current_credits
    FROM public.certificate_credits
    WHERE user_id = NEW.user_id
    FOR UPDATE;

    IF current_credits IS NULL OR current_credits <= 0 THEN
      RAISE EXCEPTION 'No certificate credits available' USING ERRCODE = 'P0001';
    END IF;

    UPDATE public.certificate_credits
    SET credits = credits - 1, updated_at = now()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_cert_credit ON public.pet_certificates;
CREATE TRIGGER trg_enforce_cert_credit
  BEFORE UPDATE ON public.pet_certificates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_certificate_credit_on_pay();

-- Make sure assign_certificate_number runs AFTER credit enforcement
DROP TRIGGER IF EXISTS trg_assign_cert_number ON public.pet_certificates;
CREATE TRIGGER trg_assign_cert_number
  BEFORE INSERT OR UPDATE ON public.pet_certificates
  FOR EACH ROW EXECUTE FUNCTION public.assign_certificate_number();

-- ============================================================================
-- 2. REAL-TIME AI MODERATION TRIGGERS
-- Wire enqueue_moderation() onto every content table so new submissions are
-- queued + ai-moderation function fired immediately.
-- ============================================================================
DROP TRIGGER IF EXISTS trg_moderate_profile ON public.profiles;
CREATE TRIGGER trg_moderate_profile
  AFTER INSERT OR UPDATE OF full_name, address, city, country, phone ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('profile');

DROP TRIGGER IF EXISTS trg_moderate_pet ON public.pets;
CREATE TRIGGER trg_moderate_pet
  AFTER INSERT OR UPDATE OF name, species, breed, color, notes, microchip_number ON public.pets
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('pet');

DROP TRIGGER IF EXISTS trg_moderate_business ON public.business_listings;
CREATE TRIGGER trg_moderate_business
  AFTER INSERT OR UPDATE OF name, description, address, phone, email, website ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('business_listing');

DROP TRIGGER IF EXISTS trg_moderate_lost ON public.lost_reports;
CREATE TRIGGER trg_moderate_lost
  AFTER INSERT OR UPDATE OF description, last_seen_address, reward, contact_phone ON public.lost_reports
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('lost_report');

DROP TRIGGER IF EXISTS trg_moderate_contact ON public.contact_submissions;
CREATE TRIGGER trg_moderate_contact
  AFTER INSERT ON public.contact_submissions
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('contact_submission');

DROP TRIGGER IF EXISTS trg_moderate_admin_msg ON public.admin_messages;
CREATE TRIGGER trg_moderate_admin_msg
  AFTER INSERT ON public.admin_messages
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('admin_message');

-- ============================================================================
-- 3. NOTIFY MEMBER WHEN THEIR CONTENT GETS AUTO-PAUSED
-- Trigger on moderation_flags: when a row is auto_paused, send notification
-- + admin_message to the owner explaining what happened.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.notify_owner_of_pause()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_label text;
BEGIN
  IF NEW.auto_paused = true AND NEW.owner_user_id IS NOT NULL THEN
    v_label := CASE NEW.entity_type
      WHEN 'pet' THEN 'pet listing'
      WHEN 'business_listing' THEN 'business listing'
      WHEN 'lost_report' THEN 'lost pet report'
      WHEN 'profile' THEN 'profile'
      WHEN 'admin_message' THEN 'message'
      WHEN 'contact_submission' THEN 'contact submission'
      ELSE NEW.entity_type
    END;

    -- In-app notification
    PERFORM public.insert_system_notification(
      NEW.owner_user_id,
      '⚠️ Your ' || v_label || ' is under review',
      'Our system flagged your recent ' || v_label || ' for review. Reason: ' || NEW.reason ||
      '. Please update it with accurate information. If this is a mistake, contact support.',
      'moderation',
      '/dashboard'
    );

    -- Inbox message with more detail
    INSERT INTO public.admin_messages (sender_id, recipient_id, subject, message, is_html)
    VALUES (
      NEW.owner_user_id,
      NEW.owner_user_id,
      '⚠️ Your ' || v_label || ' was paused for review',
      '<p>Hi,</p><p>Our automated review system temporarily paused your ' || v_label ||
      ' because it appears to contain incorrect or suspicious information.</p>' ||
      '<p><strong>Reason:</strong> ' || NEW.reason || '</p>' ||
      '<p>Please review your submission and ensure all details are accurate (real names, real addresses, real pet info). ' ||
      'Once corrected, our team will re-review and reactivate it. If you believe this was a mistake, reply to this message.</p>' ||
      '<p>Thank you for keeping Pets Registry trustworthy.</p>',
      true
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_owner_paused ON public.moderation_flags;
CREATE TRIGGER trg_notify_owner_paused
  AFTER INSERT ON public.moderation_flags
  FOR EACH ROW EXECUTE FUNCTION public.notify_owner_of_pause();

-- ============================================================================
-- 4. INDEX for cron job efficiency
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_moderation_queue_pending
  ON public.moderation_queue (status, created_at) WHERE status = 'pending';
