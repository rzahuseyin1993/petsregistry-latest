-- Image-based AI photo verification for moderation.
-- 1) Include pet / lost-report / business image URLs in the moderation payload.
-- 2) Re-queue a pet for AI review whenever a new pet photo is uploaded.
-- Text moderation previously only inspected text fields.

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
  v_images jsonb := '[]'::jsonb;
BEGIN
  IF v_entity_type = 'profile' THEN
    v_owner := NEW.user_id;
    v_payload := jsonb_build_object(
      'full_name', NEW.full_name,
      'email', NEW.email,
      'phone', NEW.phone,
      'address', NEW.address,
      'city', NEW.city,
      'country', NEW.country
    );

  ELSIF v_entity_type = 'pet' THEN
    v_owner := NEW.owner_id;
    SELECT COALESCE(jsonb_agg(pi.image_url ORDER BY pi.sort_order, pi.created_at), '[]'::jsonb)
      INTO v_images
    FROM (
      SELECT image_url, sort_order, created_at
      FROM public.pet_images
      WHERE pet_id = NEW.id
      ORDER BY sort_order, created_at
      LIMIT 3
    ) pi;
    v_payload := jsonb_build_object(
      'name', NEW.name,
      'species', NEW.species,
      'breed', NEW.breed,
      'color', NEW.color,
      'age', NEW.age,
      'notes', NEW.notes,
      'microchip_number', NEW.microchip_number,
      'image_urls', v_images,
      'has_photos', jsonb_array_length(v_images) > 0
    );

  ELSIF v_entity_type = 'business_listing' THEN
    v_owner := NEW.owner_id;
    v_payload := jsonb_build_object(
      'name', NEW.name,
      'description', NEW.description,
      'address', NEW.address,
      'city', NEW.city,
      'country', NEW.country,
      'phone', NEW.phone,
      'email', NEW.email,
      'website', NEW.website,
      'logo_url', NEW.logo_url,
      'image_urls', CASE
        WHEN NEW.logo_url IS NOT NULL AND length(trim(NEW.logo_url)) > 0
          THEN jsonb_build_array(NEW.logo_url)
        ELSE '[]'::jsonb
      END
    );

  ELSIF v_entity_type = 'lost_report' THEN
    v_owner := NEW.reporter_id;
    -- Prefer the guest photo; otherwise fall back to the linked pet's photos.
    IF NEW.guest_pet_photo_url IS NOT NULL AND length(trim(NEW.guest_pet_photo_url)) > 0 THEN
      v_images := jsonb_build_array(NEW.guest_pet_photo_url);
    ELSE
      SELECT COALESCE(jsonb_agg(pi.image_url ORDER BY pi.sort_order, pi.created_at), '[]'::jsonb)
        INTO v_images
      FROM (
        SELECT image_url, sort_order, created_at
        FROM public.pet_images
        WHERE pet_id = NEW.pet_id
        ORDER BY sort_order, created_at
        LIMIT 3
      ) pi;
    END IF;
    v_payload := jsonb_build_object(
      'description', NEW.description,
      'last_seen_address', NEW.last_seen_address,
      'reward', NEW.reward,
      'contact_phone', NEW.contact_phone,
      'guest_pet_name', NEW.guest_pet_name,
      'guest_pet_photo_url', NEW.guest_pet_photo_url,
      'image_urls', v_images,
      'has_photos', jsonb_array_length(v_images) > 0
    );

  ELSIF v_entity_type = 'contact_submission' THEN
    v_owner := NULL;
    v_payload := jsonb_build_object(
      'name', NEW.name,
      'email', NEW.email,
      'subject', NEW.subject,
      'message', NEW.message
    );

  ELSIF v_entity_type = 'admin_message' THEN
    v_owner := NEW.sender_id;
    v_payload := jsonb_build_object(
      'subject', NEW.subject,
      'message', NEW.message,
      'recipient_id', NEW.recipient_id
    );
  END IF;

  INSERT INTO public.moderation_queue(entity_type, entity_id, owner_user_id, payload)
  VALUES (v_entity_type, NEW.id, v_owner, v_payload);

  PERFORM net.http_post(
    url := 'https://aqaausjzzkqcubgfjgnc.supabase.co/functions/v1/ai-moderation',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'auto')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

-- When a pet photo is uploaded (often AFTER the pet row), re-queue the parent pet
-- so the AI can vision-check the new image against the pet's declared details.
CREATE OR REPLACE FUNCTION public.enqueue_pet_image_moderation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet record;
  v_images jsonb := '[]'::jsonb;
BEGIN
  SELECT id, owner_id, name, species, breed, color, age, notes, microchip_number
    INTO v_pet
  FROM public.pets
  WHERE id = NEW.pet_id;

  IF v_pet.id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(jsonb_agg(pi.image_url ORDER BY pi.sort_order, pi.created_at), '[]'::jsonb)
    INTO v_images
  FROM (
    SELECT image_url, sort_order, created_at
    FROM public.pet_images
    WHERE pet_id = NEW.pet_id
    ORDER BY sort_order, created_at
    LIMIT 3
  ) pi;

  INSERT INTO public.moderation_queue(entity_type, entity_id, owner_user_id, payload)
  VALUES (
    'pet',
    v_pet.id,
    v_pet.owner_id,
    jsonb_build_object(
      'name', v_pet.name,
      'species', v_pet.species,
      'breed', v_pet.breed,
      'color', v_pet.color,
      'age', v_pet.age,
      'notes', v_pet.notes,
      'microchip_number', v_pet.microchip_number,
      'image_urls', v_images,
      'has_photos', true,
      'trigger', 'pet_image_upload',
      'new_image_url', NEW.image_url
    )
  );

  PERFORM net.http_post(
    url := 'https://aqaausjzzkqcubgfjgnc.supabase.co/functions/v1/ai-moderation',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object('trigger', 'auto')
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_moderate_pet_image ON public.pet_images;
CREATE TRIGGER trg_moderate_pet_image
  AFTER INSERT ON public.pet_images
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_pet_image_moderation();

-- Also re-check lost reports when the guest photo URL is set/changed.
DROP TRIGGER IF EXISTS trg_moderate_lost ON public.lost_reports;
CREATE TRIGGER trg_moderate_lost
  AFTER INSERT OR UPDATE OF description, last_seen_address, reward, contact_phone, guest_pet_photo_url
  ON public.lost_reports
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('lost_report');

-- Re-check business listings when logo changes.
DROP TRIGGER IF EXISTS trg_moderate_business ON public.business_listings;
CREATE TRIGGER trg_moderate_business
  AFTER INSERT OR UPDATE OF name, description, address, phone, email, website, logo_url
  ON public.business_listings
  FOR EACH ROW EXECUTE FUNCTION public.enqueue_moderation('business_listing');
