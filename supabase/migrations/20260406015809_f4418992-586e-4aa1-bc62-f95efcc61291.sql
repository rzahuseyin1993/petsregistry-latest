
-- Change default of admin_approved to false (require approval by default)
ALTER TABLE public.pet_adoptions ALTER COLUMN admin_approved SET DEFAULT false;

-- Create trigger function to auto-approve listings from paid members
CREATE OR REPLACE FUNCTION public.auto_approve_adoption_for_paid_members()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the owner has an active paid membership
  IF EXISTS (
    SELECT 1 FROM public.memberships m
    WHERE m.user_id = NEW.owner_id
      AND m.status = 'active'
      AND m.expires_at > now()
  ) THEN
    NEW.admin_approved := true;
  END IF;
  RETURN NEW;
END;
$$;

-- Attach the trigger to pet_adoptions on INSERT
CREATE TRIGGER trg_auto_approve_paid_member_adoption
BEFORE INSERT ON public.pet_adoptions
FOR EACH ROW
EXECUTE FUNCTION public.auto_approve_adoption_for_paid_members();
