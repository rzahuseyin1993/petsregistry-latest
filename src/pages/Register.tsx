import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate } from "react-router-dom";
import CountrySelect from "@/components/CountrySelect";
import { PawPrint, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useMobilePath } from "@/hooks/useIsMobileRoute";
import GoogleSignInButton from "@/components/GoogleSignInButton";
import { firstError, validateEmail, validatePhone, validateRequired } from "@/lib/validation";

const TERMS_TEXT = `Privacy Policy & Global Terms of Use

1. No Liability & "User-Bears-All" Risk
PetsRegistry.org is a neutral platform provider only. We are not responsible for the safety, health, or recovery of any pet. The user assumes 100% of the risk associated with registering a pet, meeting strangers to recover a pet, or following any advice from our AI or directory.

No Warranty: We do not guarantee that the website will be online, that QR codes will work, or that data will be saved. You use this service at your own peril.

Release of Claims: By clicking "Register," you irrevocably release PetsRegistry.org and its owners from any and all claims, lawsuits, or damages (direct or indirect) forever.

2. Privacy & Public Exposure
You understand that the purpose of this site is to help people find your pet. Therefore, any data you provide (Phone, Email, Photo) may become publicly accessible via search or QR scan.

Data Responsibility: You are solely responsible for the privacy of the data you upload. If your data is stolen, scraped, or misused by third parties, you agree not to hold us responsible.

3. AI & Professional Advice
Our "AI Pets Expert" is a machine learning model. It is not a veterinarian, lawyer, or professional trainer. If the AI gives advice that leads to injury or loss, the user acknowledges they followed that advice at their own discretion and cannot blame the website.

4. Governing Law: International Principles
This agreement is governed by the UNIDROIT Principles of International Commercial Contracts (2016). Any dispute shall be settled through binding arbitration. While we strive to follow general data principles (like GDPR), this website operates globally. If the website is illegal in your specific country, you are forbidden from using it.

5. Termination of Service
We reserve the right to delete any account, pet, or business listing at any time, for any reason, without notice and without refund.`;

const Register = () => {
  const navigate = useNavigate();
  const mp = useMobilePath();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const termsRef = useRef<HTMLDivElement>(null);

  const handleTermsScroll = useCallback(() => {
    const el = termsRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 20;
    if (atBottom) setHasScrolledToBottom(true);
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) {
      toast.error("You must accept the Terms of Use to register.");
      return;
    }
    const validationError = firstError(
      validateRequired(name, "Full name", { min: 2, max: 100 }),
      validateEmail(email, { required: true }),
      validatePhone(phone),
      validateRequired(address, "Address", { min: 3, max: 200 }),
      validateRequired(city, "City", { min: 2, max: 100 }),
      validateRequired(country, "Country"),
      password.length < 6 ? "Password must be at least 6 characters." : null,
      password.length > 72 ? "Password must be at most 72 characters." : null,
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: name.trim(), phone: phone.trim() },
        emailRedirectTo: window.location.origin,
      },
    });
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    if (signUpData?.session && signUpData.user) {
      // Signed in immediately — save the address fields to the profile now.
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ address: address.trim(), city: city.trim(), country })
        .eq("user_id", signUpData.user.id);
      setLoading(false);
      if (profileErr) {
        toast.warning("Account created, but we couldn't save your address. You can add it in Settings.");
      } else {
        toast.success("Account created! Welcome to Pets Registry.");
      }
      navigate(mp("/dashboard"));
    } else {
      // Email confirmation required — there is no session yet, so the profile
      // can't be updated now; the complete-profile prompt will collect it later.
      setLoading(false);
      toast.success("Account created! Check your email to confirm, then sign in.");
      navigate(mp("/login"));
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <Card className="w-full max-w-md border-border shadow-lg">
          <CardHeader className="pb-4 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
              <PawPrint className="h-7 w-7 text-primary" />
            </div>
            <CardTitle className="font-display text-2xl">Create Account</CardTitle>
            <p className="text-sm text-muted-foreground">Register to start adding your pets</p>
          </CardHeader>
          <CardContent>
            {/* Google signup must also accept the Terms below */}
            <div
              onClickCapture={(e) => {
                if (!termsAccepted) {
                  e.preventDefault();
                  e.stopPropagation();
                  toast.error("Please read and accept the Terms of Use below before signing up with Google.");
                }
              }}
            >
              <GoogleSignInButton label="Sign up with Google" />
            </div>
            <div className="my-5 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs uppercase tracking-wide text-muted-foreground">or</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <form className="space-y-4" onSubmit={handleRegister}>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name</Label>
                <Input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" type="tel" placeholder="+1 555-0000" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" placeholder="123 Main St" value={address} onChange={(e) => setAddress(e.target.value)} required className="rounded-lg" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-lg" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <CountrySelect id="country" value={country} onChange={setCountry} required className="rounded-lg" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className="rounded-lg" />
              </div>

              {/* Terms scroll box */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground">Terms of Use & Privacy Policy</Label>
                <p className="text-xs text-muted-foreground">Scroll to the bottom to enable the checkbox</p>
                <div
                  ref={termsRef}
                  onScroll={handleTermsScroll}
                  className="h-36 overflow-y-auto rounded-lg border border-border bg-muted/30 p-3 text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed"
                >
                  {TERMS_TEXT}
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="terms"
                    checked={termsAccepted}
                    onCheckedChange={(v) => setTermsAccepted(v === true)}
                    disabled={!hasScrolledToBottom}
                    className="mt-0.5"
                  />
                  <label htmlFor="terms" className={`text-xs leading-snug ${hasScrolledToBottom ? "text-foreground" : "text-muted-foreground"}`}>
                    I agree that PetsRegistry.org has zero liability for my pet's safety or my data. I accept the International Terms of Use and will not hold the owner responsible for any problems.
                  </label>
                </div>
              </div>

              <Button className="w-full gap-2 rounded-lg" type="submit" disabled={loading || !termsAccepted}>
                <UserPlus className="h-4 w-4" /> {loading ? "Creating..." : "Create Account"}
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to={mp("/login")} className="font-medium text-primary hover:underline">Sign In</Link>
            </p>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default Register;
