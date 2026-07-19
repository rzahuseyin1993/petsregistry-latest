import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CountrySelect from "@/components/CountrySelect";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { UserCog } from "lucide-react";
import { firstError, validatePhone, validateRequired } from "@/lib/validation";

/**
 * Shown automatically the first time a user (typically Google OAuth signups)
 * lands on the dashboard without a complete profile. OAuth doesn't capture
 * phone/address/city/country, so we prompt for them once.
 */
const CompleteProfilePrompt = () => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [fullName, setFullName] = useState("");

  useEffect(() => {
    if (!user || !profile) return;
    const dismissedKey = `profile-complete-dismissed-${user.id}`;
    const dismissed = localStorage.getItem(dismissedKey);
    const incomplete = !profile.phone || !profile.address || !profile.city || !profile.country || !profile.full_name;
    if (incomplete && !dismissed) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setCity(profile.city || "");
      setCountry(profile.country || "");
      setOpen(true);
    }
  }, [user, profile]);

  const handleSave = async () => {
    if (!user) return;
    const validationError = firstError(
      validateRequired(fullName, "Full name", { min: 2, max: 100 }),
      validatePhone(phone, { required: true }),
      validateRequired(address, "Address", { min: 3, max: 200 }),
      validateRequired(city, "City", { min: 2, max: 100 }),
      validateRequired(country, "Country"),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), country })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile completed — welcome aboard!");
    localStorage.setItem(`profile-complete-dismissed-${user.id}`, "1");
    setOpen(false);
    // Refresh page so AuthContext picks up new profile
    window.location.reload();
  };

  const handleSkip = () => {
    if (!user) return;
    localStorage.setItem(`profile-complete-dismissed-${user.id}`, "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleSkip()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <UserCog className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Complete your profile</DialogTitle>
          <DialogDescription className="text-center">
            We need a few more details so we can contact you about lost pets, adoption requests, and orders.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="cp-name">Full Name</Label>
            <Input id="cp-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Your name" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-phone">Phone</Label>
            <Input id="cp-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555-0000" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="cp-address">Address</Label>
            <Input id="cp-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Main St" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="cp-city">City</Label>
              <Input id="cp-city" value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cp-country">Country</Label>
              <CountrySelect id="cp-country" value={country} onChange={setCountry} />
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={handleSkip} disabled={saving}>Skip for now</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving..." : "Save & Continue"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CompleteProfilePrompt;
