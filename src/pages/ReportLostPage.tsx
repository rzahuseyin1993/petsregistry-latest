import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { AlertTriangle, MapPin, Loader2, UserPlus, UserX, Camera, Search, HeartHandshake, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { uploadImage } from "@/lib/imageUpload";
import { extractPhotoGps, reverseGeocode, formatCoords } from "@/lib/geo";
import WebcamCaptureDialog from "@/components/WebcamCaptureDialog";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { getCountryLabel } from "@/lib/geoCountry";
import { validateDateNotFuture, validateEmail, validateImageFile, validateOptionalLength, validatePhone } from "@/lib/validation";

const ReportLostPage = () => {
  const { user } = useAuth();
  const { visitorCountry } = useVisitorGeo();
  const navigate = useNavigate();
  const [reportType, setReportType] = useState<"lost" | "found">("lost");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showAuthChoice, setShowAuthChoice] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [locationFromPhoto, setLocationFromPhoto] = useState(false);
  const [signupForm, setSignupForm] = useState({ email: "", password: "", fullName: "" });

  const isFound = reportType === "found";
  const labels = {
    heroTitle: isFound ? "Report a Found Pet" : "Report a Lost Pet",
    heroSubtitle: isFound
      ? "You spotted a pet that may be lost? Post it here so the owner can find them."
      : "Your pet is missing? Post details so the community can help reunite you.",
    petDetailsTitle: isFound ? "Pet Details (what you saw)" : "Pet Details",
    petNameLabel: isFound ? "Pet Name (if known)" : "Pet Name (optional)",
    locationLabel: isFound ? "Where you spotted them (optional)" : "Where you last saw them (optional)",
    descriptionPlaceholder: isFound
      ? "Where exactly, time, condition, behaviour, was it wearing a collar..."
      : "Distinguishing features, collar, behaviour...",
    contactTitle: isFound ? "Your Contact (kept private)" : "Your Contact (kept private)",
    contactNote: isFound
      ? "Your phone & email are never shown publicly. The owner will reach you through a private 'Contact' button."
      : "Your phone & email are never shown publicly. People who spot your pet will contact you through a button.",
    submitLabel: isFound ? "Submit Found Pet Report" : "Submit Lost Report",
  };

  const [form, setForm] = useState({
    pet_name: "",
    species: "",
    breed: "",
    description: "",
    last_seen_date: new Date().toISOString().slice(0, 10),
    last_seen_address: "",
    last_seen_lat: null as number | null,
    last_seen_lng: null as number | null,
    reward: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  const applyCoords = async (lat: number, lng: number, source: "photo" | "device") => {
    setForm((f) => ({
      ...f,
      last_seen_lat: lat,
      last_seen_lng: lng,
      last_seen_address: f.last_seen_address || formatCoords(lat, lng),
    }));
    // Try to upgrade the placeholder coords string to a real address
    const address = await reverseGeocode(lat, lng);
    if (address) {
      setForm((f) => ({
        ...f,
        // Only overwrite if the user hasn't typed a custom address since
        last_seen_address:
          !f.last_seen_address || f.last_seen_address === formatCoords(lat, lng)
            ? address
            : f.last_seen_address,
      }));
    }
    if (source === "photo") setLocationFromPhoto(true);
    toast.success(source === "photo" ? "Location read from photo GPS" : "Location captured");
  };

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateImageFile(file, { maxMb: 10, label: "Pet photo" });
    if (fileError) { toast.error(fileError); return; }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    // Auto-extract GPS from photo if no location captured yet
    if (form.last_seen_lat == null) {
      const gps = await extractPhotoGps(file);
      if (gps) await applyCoords(gps.lat, gps.lng, "photo");
    }
  };

  const handleWebcamCapture = async (file: File, dataUrl: string) => {
    setPhotoFile(file);
    setPhotoPreview(dataUrl);
    if (form.last_seen_lat == null) {
      const gps = await extractPhotoGps(file);
      if (gps) await applyCoords(gps.lat, gps.lng, "photo");
    }
  };

  const handleGetLocation = () => {
    if (!navigator.geolocation) { toast.error("Geolocation not supported"); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await applyCoords(pos.coords.latitude, pos.coords.longitude, "device");
        setLocating(false);
      },
      () => { setLocating(false); toast.error("Could not get location"); }
    );
  };

  const validate = () => {
    // Public-friendly: only photo + reporter contact are required.
    // The reporter often doesn't know the pet's name/breed/species — those are optional.
    if (!photoFile) return "A photo is required so people can recognise the pet";
    if (!form.contact_name.trim()) return "Your name is required so we can reach you";
    const emailError = validateEmail(form.contact_email, { required: true });
    if (emailError) return emailError;
    const phoneError = validatePhone(form.contact_phone);
    if (phoneError) return phoneError;
    const dateError = validateDateNotFuture(form.last_seen_date, isFound ? "Date spotted" : "Date last seen");
    if (dateError) return dateError;
    return (
      validateOptionalLength(form.pet_name, "Pet name", 100) ||
      validateOptionalLength(form.species, "Species", 50) ||
      validateOptionalLength(form.breed, "Breed", 100) ||
      validateOptionalLength(form.reward, "Reward", 50) ||
      validateOptionalLength(form.description, "Description", 2000) ||
      validateOptionalLength(form.last_seen_address, "Location", 300) ||
      validateOptionalLength(form.contact_name, "Your name", 100)
    );
  };

  const handleStartSubmit = () => {
    const err = validate();
    if (err) { toast.error(err); return; }
    if (user) {
      // Logged in — submit immediately
      submitReport(user.id, false);
    } else {
      setShowAuthChoice(true);
    }
  };

  const submitReport = async (reporterId: string | null, isGuest: boolean) => {
    setSubmitting(true);
    try {
      let photoUrl: string | null = null;
      if (photoFile) {
        try {
          photoUrl = await uploadImage(photoFile, "pet-photos", "guest-lost");
        } catch (e) {
          console.warn("Photo upload failed", e);
          throw new Error("Photo upload failed. Please try again with a different photo.");
        }
      }

      const effectivePetName = form.pet_name.trim() || (isFound ? "Unknown (found pet)" : "Unknown pet");
      const effectiveSpecies = form.species.trim() || "Unknown";
      const descriptionWithTag = isFound
        ? `[FOUND PET SIGHTING] ${form.description || ""}`.trim()
        : form.description || null;

      // Guest reports do not link to a pet, so we use a placeholder pet record.
      // For logged-in "I lost my pet" reports, we still create a stub pet under their account
      // so they can manage it from the dashboard later.

      let petId: string;

      if (reporterId && !isFound) {
        const { data: petData, error: petErr } = await supabase.from("pets").insert({
          owner_id: reporterId,
          name: effectivePetName,
          species: effectiveSpecies,
          breed: form.breed || null,
          status: "lost",
          notes: form.description || null,
        }).select("id").single();
        if (petErr) throw petErr;
        petId = petData.id;
        if (photoUrl) {
          await supabase.from("pet_images").insert({
            pet_id: petId,
            image_url: photoUrl,
            sort_order: 0,
          });
        }
      } else {
        // Guest OR found-pet report: use the shared placeholder pet
        const { data: setting } = await supabase
          .from("site_settings").select("value").eq("key", "guest_lost_pet_id").maybeSingle();
        if (!setting?.value) {
          throw new Error("Guest reporting is not yet configured. Please sign up to submit a report.");
        }
        petId = setting.value;
      }

      const treatAsGuestData = isGuest || isFound;

      const { error: reportErr } = await supabase.from("lost_reports").insert({
        pet_id: petId,
        reporter_id: reporterId,
        is_guest: isGuest,
        last_seen_address: form.last_seen_address || null,
        last_seen_lat: form.last_seen_lat,
        last_seen_lng: form.last_seen_lng,
        description: descriptionWithTag,
        reward: isFound ? null : (form.reward || null),
        contact_phone: form.contact_phone || null,
        guest_name: treatAsGuestData ? form.contact_name : null,
        guest_email: treatAsGuestData ? form.contact_email : null,
        guest_phone: treatAsGuestData ? form.contact_phone : null,
        guest_pet_name: treatAsGuestData ? effectivePetName : (form.pet_name.trim() || null),
        guest_pet_species: treatAsGuestData ? form.species : (form.species.trim() || null),
        guest_pet_breed: treatAsGuestData ? form.breed : (form.breed.trim() || null),
        guest_pet_photo_url: photoUrl,
        last_seen_date: form.last_seen_date || null,
        reporter_country: getCountryLabel(visitorCountry),
      });
      if (reportErr) throw reportErr;

      toast.success(isFound ? "Found pet report submitted! Thank you for helping reunite a pet." : "Lost report submitted! Thank you for helping reunite this pet.");
      navigate("/lost-pets");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
      setShowAuthChoice(false);
      setShowSignup(false);
    }
  };

  const handleSignupAndSubmit = async () => {
    const signupEmailError = validateEmail(signupForm.email, { required: true });
    if (signupEmailError) {
      toast.error(signupEmailError);
      return;
    }
    if (!signupForm.password || signupForm.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: signupForm.email,
        password: signupForm.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { full_name: signupForm.fullName || form.contact_name },
        },
      });
      if (error) throw error;
      const newUserId = data.user?.id;
      if (!newUserId) throw new Error("Signup failed");

      // Wait briefly for profile trigger
      await new Promise((r) => setTimeout(r, 800));
      await submitReport(newUserId, false);
    } catch (err: any) {
      toast.error(err.message || "Signup failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container max-w-2xl">
          <div className="mb-6 flex items-center gap-3">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${isFound ? "bg-primary/10" : "bg-destructive/10"}`}>
              {isFound ? (
                <HeartHandshake className="h-6 w-6 text-primary" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-destructive" />
              )}
            </div>
            <div>
              <h1 className="font-display text-2xl font-bold text-foreground md:text-3xl">{labels.heroTitle}</h1>
              <p className="text-sm text-muted-foreground">{labels.heroSubtitle} No account needed to start.</p>
            </div>
          </div>

          {/* Lost / Found toggle */}
          <div className="mb-4 inline-flex rounded-lg border border-border bg-muted/40 p-1">
            <button
              type="button"
              onClick={() => setReportType("lost")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                !isFound ? "bg-destructive text-destructive-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              I lost my pet
            </button>
            <button
              type="button"
              onClick={() => setReportType("found")}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition ${
                isFound ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Search className="h-4 w-4" />
              I found / spotted a pet
            </button>
          </div>

          <Card>
            <CardHeader><CardTitle>{labels.petDetailsTitle}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Pet Photo</Label>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <div className="flex h-24 w-24 items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/40 overflow-hidden">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
                    ) : (
                      <Camera className="h-6 w-6 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => setWebcamOpen(true)}>
                        <Camera className="mr-2 h-4 w-4" /> Take photo
                      </Button>
                      <Button asChild type="button" variant="outline" size="sm">
                        <label className="cursor-pointer">
                          <Upload className="mr-2 h-4 w-4" /> Upload photo
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={handlePhoto}
                          />
                        </label>
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      A clear photo greatly improves chances of being reunited. If your photo has GPS data (most phone camera photos), we will auto-fill the last seen location.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>{labels.petNameLabel}</Label>
                  <Input
                    placeholder={isFound ? "Leave blank if unknown" : ""}
                    value={form.pet_name}
                    onChange={(e) => setForm({ ...form, pet_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Species (optional)</Label>
                  <Input placeholder="Dog, Cat, leave blank if unsure…" value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })} />
                </div>
                <div>
                  <Label>Breed (optional)</Label>
                  <Input placeholder="Leave blank if unknown" value={form.breed} onChange={(e) => setForm({ ...form, breed: e.target.value })} />
                </div>
                {!isFound && (
                  <div>
                    <Label>Reward (optional)</Label>
                    <Input placeholder="e.g. $100" value={form.reward} onChange={(e) => setForm({ ...form, reward: e.target.value })} />
                  </div>
                )}
              </div>

              <div>
                <Label>{isFound ? "Date spotted" : "Date last seen"}</Label>
                <Input
                  type="date"
                  className="mt-1"
                  value={form.last_seen_date}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setForm({ ...form, last_seen_date: e.target.value })}
                />
              </div>

              <div>
                <Label>{labels.locationLabel}</Label>
                <div className="mt-1 flex gap-2">
                  <Input
                    placeholder="Street, area, city"
                    value={form.last_seen_address}
                    onChange={(e) => setForm({ ...form, last_seen_address: e.target.value })}
                  />
                  <Button type="button" variant="outline" size="icon" onClick={handleGetLocation} disabled={locating}>
                    {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  </Button>
                </div>
                {locationFromPhoto && (
                  <p className="mt-1 text-xs text-primary flex items-center gap-1">
                    <MapPin className="h-3 w-3" /> Location auto-filled from photo GPS
                  </p>
                )}
              </div>

              <div>
                <Label>Description</Label>
                <Textarea
                  rows={3}
                  placeholder={labels.descriptionPlaceholder}
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="mt-4">
            <CardHeader><CardTitle>{labels.contactTitle}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                {labels.contactNote}
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <Label>Your Name *</Label>
                  <Input value={form.contact_name} onChange={(e) => setForm({ ...form, contact_name: e.target.value })} />
                </div>
                <div>
                  <Label>Your Email *</Label>
                  <Input type="email" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
                </div>
                <div className="md:col-span-2">
                  <Label>Phone (optional)</Label>
                  <Input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
                </div>
              </div>

              <Button
                size="lg"
                className={`w-full ${isFound ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-destructive text-destructive-foreground hover:bg-destructive/90"}`}
                onClick={handleStartSubmit}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (isFound ? <HeartHandshake className="mr-2 h-4 w-4" /> : <AlertTriangle className="mr-2 h-4 w-4" />)}
                {labels.submitLabel}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Auth choice */}
      <Dialog open={showAuthChoice} onOpenChange={setShowAuthChoice}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>One last step</DialogTitle>
            <DialogDescription>
              Create a free account so you can edit, mark as found, and get notifications — or continue as a guest.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Button className="w-full justify-start gap-2" onClick={() => { setShowAuthChoice(false); setShowSignup(true); }}>
              <UserPlus className="h-4 w-4" /> Create free account (recommended)
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2" onClick={() => submitReport(null, true)} disabled={submitting}>
              <UserX className="h-4 w-4" /> Continue as guest
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Signup */}
      <Dialog open={showSignup} onOpenChange={setShowSignup}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Create your free account</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Full name</Label>
              <Input value={signupForm.fullName} onChange={(e) => setSignupForm({ ...signupForm, fullName: e.target.value })} placeholder={form.contact_name} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={signupForm.email} onChange={(e) => setSignupForm({ ...signupForm, email: e.target.value })} placeholder={form.contact_email} />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={signupForm.password} onChange={(e) => setSignupForm({ ...signupForm, password: e.target.value })} />
            </div>
            <Button className="w-full" onClick={handleSignupAndSubmit} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Sign up & Submit Report
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <WebcamCaptureDialog open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={handleWebcamCapture} />

      <Footer />
    </div>
  );
};

export default ReportLostPage;
