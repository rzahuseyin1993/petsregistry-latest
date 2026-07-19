import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";

/** Landing page for the password-recovery email link. */
const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  useEffect(() => {
    // The recovery link signs the user in with a temporary session; without it
    // we cannot update the password.
    supabase.auth.getSession().then(({ data }) => setHasSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setHasSession(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6 || password.length > 72) {
      toast.error("Password must be between 6 and 72 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated! You are now signed in.");
    navigate("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <KeyRound className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">Set a New Password</CardTitle>
            <p className="text-sm text-muted-foreground">Choose a new password for your account</p>
          </CardHeader>
          <CardContent>
            {hasSession === false ? (
              <div className="space-y-4 text-center">
                <p className="text-sm text-muted-foreground">
                  This reset link is invalid or has expired. Please request a new one from the login page.
                </p>
                <Button className="w-full rounded-lg" onClick={() => navigate("/login")}>
                  Back to Login
                </Button>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <Label htmlFor="new-password">New password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-password">Confirm new password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    placeholder="••••••••"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="rounded-lg"
                  />
                </div>
                <Button className="w-full gap-2 rounded-lg" type="submit" disabled={saving || hasSession === null}>
                  <KeyRound className="h-4 w-4" /> {saving ? "Saving..." : "Update Password"}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default ResetPassword;
