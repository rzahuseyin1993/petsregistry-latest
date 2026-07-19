import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, PawPrint, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resizeImage, uploadRaw } from "@/lib/imageUpload";
import { useNavigate } from "react-router-dom";
import { useMobilePath } from "@/hooks/useIsMobileRoute";
import WebcamCaptureDialog from "@/components/WebcamCaptureDialog";
import PetBirthFields, { birthFormToPetPayload, emptyBirthForm, validateBirthForm } from "@/components/PetBirthFields";
import { useQuery } from "@tanstack/react-query";
import { firstError, validateImageFile, validateOptionalLength, validateRequired } from "@/lib/validation";

const speciesOptions = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Hamster", "Reptile", "Bear", "Other"];

const RegisterPet = () => {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const mp = useMobilePath();
  const [showName, setShowName] = useState(true);
  const [showPhone, setShowPhone] = useState(true);

  // Initialise privacy toggles from the user's saved profile so submitting the
  // form doesn't silently overwrite settings chosen on the Settings page.
  useEffect(() => {
    if (profile) {
      setShowName(profile.show_name);
      setShowPhone(profile.show_phone);
    }
  }, [profile]);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [color, setColor] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [showBirthDetails, setShowBirthDetails] = useState(false);
  const [birthForm, setBirthForm] = useState(emptyBirthForm);

  const { data: myPets = [] } = useQuery({
    queryKey: ["my-pets-register", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id, name, pet_code").eq("owner_id", user!.id);
      return data || [];
    },
  });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    if (imageFiles.length + files.length > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    const newFiles = Array.from(files);
    for (const f of newFiles) {
      const fileError = validateImageFile(f, { maxMb: 10, label: `"${f.name}"` });
      if (fileError) { toast.error(fileError); return; }
    }
    setImageFiles((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newFiles.map((f) => URL.createObjectURL(f))]);
  };

  const removeImage = (index: number) => {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => {
      const removed = prev[index];
      if (removed?.startsWith("blob:")) URL.revokeObjectURL(removed);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleWebcamCapture = (file: File, dataUrl: string) => {
    if (imageFiles.length >= 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    setImageFiles((prev) => [...prev, file]);
    setImagePreviews((prev) => [...prev, dataUrl]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (imageFiles.length < 1) {
      toast.error("Please upload at least 1 photo");
      return;
    }
    if (!species) {
      toast.error("Please select a species");
      return;
    }
    const validationError = firstError(
      validateRequired(petName, "Pet name", { min: 1, max: 100 }),
      validateOptionalLength(breed, "Breed", 100),
      validateOptionalLength(age, "Age", 50),
      validateOptionalLength(color, "Color", 100),
      validateOptionalLength(weight, "Weight", 50),
      validateOptionalLength(notes, "Notes", 2000),
      microchipNumber && !/^[A-Za-z0-9\-]{5,20}$/.test(microchipNumber.trim())
        ? "Microchip number must be 5-20 letters, digits, or dashes."
        : null,
      showBirthDetails ? validateBirthForm(birthForm) : null,
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);
    try {
      // Update profile privacy settings
      await supabase.from("profiles").update({ show_name: showName, show_phone: showPhone }).eq("user_id", user.id);

      // Insert pet
      const { data: pet, error: petError } = await supabase
        .from("pets")
        .insert({
          owner_id: user.id,
          name: petName.trim(),
          species,
          breed: breed.trim(),
          age: age.trim(),
          color: color.trim(),
          weight: weight.trim(),
          notes: notes.trim(),
          microchip_number: microchipNumber.trim() || null,
          ...(showBirthDetails ? birthFormToPetPayload(birthForm) : {}),
        })
        .select()
        .single();
      if (petError) throw petError;

      // Upload images — photos are required, so roll the pet back if they fail
      try {
        for (let i = 0; i < imageFiles.length; i++) {
          const file = imageFiles[i];
          const resized = await resizeImage(file);
          const publicUrl = await uploadRaw({
            bucket: "pet-photos",
            path: `${user.id}/${pet.id}/${i}.webp`,
            body: resized,
            contentType: "image/webp",
            upsert: true,
          });

          const { error: imgError } = await supabase.from("pet_images").insert({
            pet_id: pet.id,
            image_url: publicUrl,
            sort_order: i,
          });
          if (imgError) throw imgError;
        }
      } catch (uploadErr: any) {
        await supabase.from("pets").delete().eq("id", pet.id).eq("owner_id", user.id);
        throw new Error(uploadErr?.message ? `Photo upload failed: ${uploadErr.message}` : "Photo upload failed. Please try again.");
      }

      toast.success("Pet registered successfully!");
      navigate(mp("/dashboard"));
    } catch (err: any) {
      toast.error(err.message || "Failed to register pet");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <h1 className="font-display text-2xl font-bold text-foreground">Register a New Pet</h1>
          <p className="text-sm text-muted-foreground">Fill in your pet's details below</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pet Photos</CardTitle>
                <p className="text-sm text-muted-foreground">Upload 1-5 photos of your pet</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {imagePreviews.map((img, i) => (
                    <div key={i} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                      <img src={img} alt="" className="h-full w-full object-cover" />
                      <button type="button" onClick={() => removeImage(i)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground">×</button>
                    </div>
                  ))}
                  {imagePreviews.length < 5 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setWebcamOpen(true)}
                        className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Camera className="h-6 w-6" /><span className="mt-1 text-xs">Take Photo</span>
                      </button>
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
                        <Upload className="h-6 w-6" /><span className="mt-1 text-xs">Upload</span>
                        <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} />
                      </label>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-lg">Pet Details</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="petName">Pet Name</Label>
                    <Input id="petName" placeholder="e.g., Bella" required value={petName} onChange={(e) => setPetName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Species</Label>
                    <Select value={species} onValueChange={setSpecies}>
                      <SelectTrigger><SelectValue placeholder="Select species" /></SelectTrigger>
                      <SelectContent>
                        {speciesOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="breed">Breed</Label>
                    <Input id="breed" placeholder="e.g., Golden Retriever" value={breed} onChange={(e) => setBreed(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" placeholder="e.g., 3 years" value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input id="color" placeholder="e.g., Golden" value={color} onChange={(e) => setColor(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input id="weight" placeholder="e.g., 30 kg" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="microchip">Microchip Number</Label>
                    <Input id="microchip" placeholder="e.g., 900123456789012" value={microchipNumber} onChange={(e) => setMicrochipNumber(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea id="notes" placeholder="Any special notes..." value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Birth &amp; breeding (optional)</CardTitle>
                <p className="text-sm text-muted-foreground">Add now if you plan to get a birth certificate</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-3">
                  <p className="text-sm font-medium">Include birth / parent details</p>
                  <Switch checked={showBirthDetails} onCheckedChange={setShowBirthDetails} />
                </div>
                {showBirthDetails && (
                  <PetBirthFields
                    values={birthForm}
                    onChange={(patch) => setBirthForm((v) => ({ ...v, ...patch }))}
                    myPets={myPets as any}
                    compact
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Privacy Settings</CardTitle>
                <p className="text-sm text-muted-foreground">Control what's visible on your pet's public profile. Email is always displayed for safety.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div><p className="text-sm font-medium text-foreground">Email Address</p><p className="text-xs text-muted-foreground">Always visible for lost pet contact</p></div>
                  <Switch checked disabled />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div><p className="text-sm font-medium text-foreground">Owner Name</p><p className="text-xs text-muted-foreground">Show your name on the public profile</p></div>
                  <Switch checked={showName} onCheckedChange={setShowName} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div><p className="text-sm font-medium text-foreground">Phone Number</p><p className="text-xs text-muted-foreground">Show your phone on the public profile</p></div>
                  <Switch checked={showPhone} onCheckedChange={setShowPhone} />
                </div>
              </CardContent>
            </Card>

            <Button type="submit" size="lg" className="w-full gap-2" disabled={loading}>
              <PawPrint className="h-5 w-5" /> {loading ? "Registering..." : "Register Pet"}
            </Button>
          </form>
        </motion.div>
        <WebcamCaptureDialog open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={handleWebcamCapture} />
      </main>
    </div>
  );
};

export default RegisterPet;
