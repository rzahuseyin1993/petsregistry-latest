import DashboardSidebar from "@/components/DashboardSidebar";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import MembershipBadge from "@/components/MembershipBadge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import CountrySelect from "@/components/CountrySelect";
import { firstError, validatePhone, validateRequired, validateOptionalLength } from "@/lib/validation";

const DashboardSettings = () => {
  const { user, profile, membership, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  
  const [showName, setShowName] = useState(true);
  const [showPhone, setShowPhone] = useState(true);
  const [saving, setSaving] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setPhone(profile.phone || "");
      setAddress(profile.address || "");
      setCity(profile.city || "");
      setCountry(profile.country || "");
      
      setShowName(profile.show_name);
      setShowPhone(profile.show_phone);
    }
  }, [profile]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const validationError = firstError(
      validateRequired(fullName, "Full name", { min: 2, max: 100 }),
      validatePhone(phone),
      validateOptionalLength(address, "Address", 200),
      validateOptionalLength(city, "City", 100),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({ full_name: fullName.trim(), phone: phone.trim(), address: address.trim(), city: city.trim(), country, show_name: showName, show_phone: showPhone } as any).eq("user_id", user.id);
    setSaving(false);
    if (error) toast.error("Failed to update profile");
    else {
      toast.success("Profile updated!");
      // Refresh the cached profile so the rest of the app sees the new values immediately
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ["my-pets"] });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (newPassword.length > 72) {
      toast.error("Password must be at most 72 characters");
      return;
    }
    if (newPassword === currentPassword) {
      toast.error("New password must be different from the current password");
      return;
    }
    setChangingPassword(true);

    // Verify current password by re-authenticating
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user?.email || "",
      password: currentPassword,
    });
    if (signInError) {
      setChangingPassword(false);
      toast.error("Current password is incorrect");
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setChangingPassword(false);
    if (error) toast.error("Failed to change password: " + error.message);
    else {
      toast.success("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    }
  };

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl font-bold text-foreground">Account Settings</h1>
          {membership && <MembershipBadge planType={membership.planType} planName={membership.planName} size="sm" />}
        </div>
        <p className="text-sm text-muted-foreground">Update your profile, privacy, and security settings</p>

        <div className="mt-8 max-w-lg space-y-6">
          <form onSubmit={handleSave} className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-lg">Profile</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2"><Label>Email</Label><Input value={user?.email || ""} disabled /></div>
                <div className="space-y-2"><Label>Full Name</Label><Input value={fullName} onChange={(e) => setFullName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
                <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Street address" /></div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2"><Label>City</Label><Input value={city} onChange={(e) => setCity(e.target.value)} /></div>
                  <div className="space-y-2"><Label>Country</Label><CountrySelect value={country} onChange={setCountry} /></div>
                </div>
                
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Privacy</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between"><span className="text-sm">Show name on pet profiles</span><Switch checked={showName} onCheckedChange={setShowName} /></div>
                <div className="flex items-center justify-between"><span className="text-sm">Show phone on pet profiles</span><Switch checked={showPhone} onCheckedChange={setShowPhone} /></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Push Notifications</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Get alerts even when the app is closed. Works on desktop and mobile browsers.</p>
                <PushNotificationToggle />
              </CardContent>
            </Card>

            <Button type="submit" disabled={saving}>{saving ? "Saving..." : "Save Changes"}</Button>
          </form>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Lock className="h-5 w-5 text-primary" />
                Change Password
              </CardTitle>
              <CardDescription>Update your account password</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input id="current-password" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input id="new-password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input id="confirm-password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
                </div>
                <Button type="submit" variant="outline" disabled={changingPassword} className="gap-2">
                  <Lock className="h-4 w-4" />
                  {changingPassword ? "Changing..." : "Change Password"}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default DashboardSettings;
