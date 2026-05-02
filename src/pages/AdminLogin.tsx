import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, LogIn, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useCallback } from "react";
import { toast } from "sonner";

const generateCaptcha = () => {
  const a = Math.floor(Math.random() * 10) + 1;
  const b = Math.floor(Math.random() * 10) + 1;
  return { question: `${a} + ${b} = ?`, answer: a + b };
};

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [captcha, setCaptcha] = useState(generateCaptcha);
  const [captchaInput, setCaptchaInput] = useState("");

  const refreshCaptcha = useCallback(() => {
    setCaptcha(generateCaptcha());
    setCaptchaInput("");
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (parseInt(captchaInput) !== captcha.answer) {
      toast.error("Incorrect CAPTCHA answer. Please try again.");
      refreshCaptcha();
      return;
    }

    setLoading(true);
    const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      refreshCaptcha();
      return;
    }

    // Check if user has admin or moderator role
    const { data: isAdmin, error: adminErr } = await supabase.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "admin",
    });
    const { data: isModerator, error: modErr } = await supabase.rpc("has_role", {
      _user_id: authData.user.id,
      _role: "moderator",
    });

    setLoading(false);

    if (adminErr && modErr) {
      toast.error("Unable to verify permissions. Please try again.");
      refreshCaptcha();
      return;
    }

    if (!isAdmin && !isModerator) {
      await supabase.auth.signOut();
      toast.error("Access denied. Staff privileges required.");
      refreshCaptcha();
      return;
    }

    toast.success(isAdmin ? "Welcome, Admin!" : "Welcome, Moderator!");
    navigate("/admin");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md border-border shadow-xl">
        <CardHeader className="pb-4 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldCheck className="h-7 w-7 text-destructive" />
          </div>
          <CardTitle className="font-display text-2xl">Admin Portal</CardTitle>
          <p className="text-sm text-muted-foreground">Sign in with your admin credentials</p>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={handleLogin}>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email</Label>
              <Input id="admin-email" type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input id="admin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-lg" />
            </div>
            <div className="space-y-2">
              <Label>Verify you're human</Label>
              <div className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3">
                <div className="flex h-10 items-center justify-center rounded-md bg-destructive/10 px-4">
                  <span className="font-mono text-lg font-bold text-destructive select-none">{captcha.question}</span>
                </div>
                <Input type="number" placeholder="Answer" value={captchaInput} onChange={(e) => setCaptchaInput(e.target.value)} required className="w-24 rounded-lg text-center" />
                <Button type="button" variant="ghost" size="icon" onClick={refreshCaptcha} title="New question">
                  <RefreshCw className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            </div>
            <Button className="w-full gap-2 rounded-lg" type="submit" disabled={loading}>
              <LogIn className="h-4 w-4" /> {loading ? "Verifying..." : "Sign In as Admin"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminLogin;
