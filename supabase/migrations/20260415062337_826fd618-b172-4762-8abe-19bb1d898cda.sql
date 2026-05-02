-- Trigger: auto-approve adoption listings for paid members (on insert)
CREATE TRIGGER trg_auto_approve_adoption
  BEFORE INSERT ON public.pet_adoptions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_approve_adoption_for_paid_members();

-- Trigger: handle dual-confirmation transfer (on update)
CREATE TRIGGER trg_handle_adoption_confirmation
  BEFORE UPDATE ON public.pet_adoptions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_adoption_confirmation();