
-- Add dual-confirmation columns to pet_adoptions
ALTER TABLE public.pet_adoptions
  ADD COLUMN IF NOT EXISTS owner_confirmed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS adopter_confirmed boolean NOT NULL DEFAULT false;

-- Create a function to auto-transfer pet when both parties confirm
CREATE OR REPLACE FUNCTION public.handle_adoption_confirmation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- When both parties have confirmed and status is pending, complete the transfer
  IF NEW.owner_confirmed = true AND NEW.adopter_confirmed = true AND NEW.status = 'pending' AND NEW.adopter_id IS NOT NULL THEN
    -- Transfer pet ownership
    UPDATE public.pets SET owner_id = NEW.adopter_id, updated_at = now() WHERE id = NEW.pet_id;
    -- Mark adoption as completed
    NEW.status := 'completed';
    NEW.updated_at := now();
    -- Send notification to both parties
    PERFORM insert_system_notification(
      NEW.owner_id,
      'Pet Transfer Complete',
      'Your pet has been successfully transferred to the new owner.',
      'adoption',
      '/dashboard/adoption'
    );
    PERFORM insert_system_notification(
      NEW.adopter_id,
      'Adoption Complete!',
      'The pet has been transferred to your account. You can now manage it from your dashboard.',
      'adoption',
      '/dashboard'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS on_adoption_confirmation ON public.pet_adoptions;
CREATE TRIGGER on_adoption_confirmation
  BEFORE UPDATE ON public.pet_adoptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_adoption_confirmation();
