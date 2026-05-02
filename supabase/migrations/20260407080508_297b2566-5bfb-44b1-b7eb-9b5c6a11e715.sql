
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
  ELSE
    -- Notify all admins that a listing needs approval
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT ur.user_id,
           'Adoption Listing Pending Approval',
           'A new adoption listing requires your review and approval.',
           'adoption',
           '/admin/adoptions'
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;
