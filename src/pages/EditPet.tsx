import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, PawPrint, Trash2, ArrowLeft, Camera } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { resizeImage, uploadRaw } from "@/lib/imageUpload";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useMobilePath } from "@/hooks/useIsMobileRoute";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import WebcamCaptureDialog from "@/components/WebcamCaptureDialog";
import PetBirthFields, { birthFormToPetPayload, emptyBirthForm, petToBirthForm, validateBirthForm } from "@/components/PetBirthFields";
import { firstError, validateImageFile, validateOptionalLength, validateRequired } from "@/lib/validation";

const speciesOptions = ["Dog", "Cat", "Bird", "Fish", "Rabbit", "Hamster", "Reptile", "Bear", "Other"];

const EditPet = () => {
  const { user } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const mp = useMobilePath();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [petName, setPetName] = useState("");
  const [species, setSpecies] = useState("");
  const [breed, setBreed] = useState("");
  const [age, setAge] = useState("");
  const [color, setColor] = useState("");
  const [weight, setWeight] = useState("");
  const [notes, setNotes] = useState("");
  const [microchipNumber, setMicrochipNumber] = useState("");
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newImagePreviews, setNewImagePreviews] = useState<string[]>([]);
  const [webcamOpen, setWebcamOpen] = useState(false);
  const [birthForm, setBirthForm] = useState(emptyBirthForm);
  const [sirePhotoFile, setSirePhotoFile] = useState<File | null>(null);
  const [damPhotoFile, setDamPhotoFile] = useState<File | null>(null);
  const [sirePreview, setSirePreview] = useState<string | null>(null);
  const [damPreview, setDamPreview] = useState<string | null>(null);

  const { data: myPets = [] } = useQuery({
    queryKey: ["my-pets-edit-list", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("pets").select("id, name, pet_code").eq("owner_id", user!.id);
      return (data || []).filter((p) => p.id !== id);
    },
  });

  const { data: pet, isLoading } = useQuery({
    queryKey: ["edit-pet", id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets")
        .select("*, pet_images(id, image_url, sort_order)")
        .eq("id", id!)
        .eq("owner_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (pet) {
      setPetName(pet.name || "");
      setSpecies(pet.species || "");
      setBreed(pet.breed || "");
      setAge(pet.age || "");
      setColor(pet.color || "");
      setWeight(pet.weight || "");
      setNotes(pet.notes || "");
      setMicrochipNumber(pet.microchip_number || "");
      setBirthForm(petToBirthForm(pet));
      setSirePreview(pet.sire_photo_url || null);
      setDamPreview(pet.dam_photo_url || null);
    }
  }, [pet]);

  const existingImages = (pet?.pet_images || []).slice().sort((a: any, b: any) => a.sort_order - b.sort_order);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const total = existingImages.length + newImageFiles.length + files.length;
    if (total > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    const arr = Array.from(files);
    for (const f of arr) {
      const fileError = validateImageFile(f, { maxMb: 10, label: `"${f.name}"` });
      if (fileError) { toast.error(fileError); return; }
    }
    setNewImageFiles((p) => [...p, ...arr]);
    setNewImagePreviews((p) => [...p, ...arr.map((f) => URL.createObjectURL(f))]);
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles((p) => p.filter((_, i) => i !== index));
    setNewImagePreviews((p) => p.filter((_, i) => i !== index));
  };

  const handleWebcamCapture = (file: File, dataUrl: string) => {
    const total = existingImages.length + newImageFiles.length + 1;
    if (total > 5) {
      toast.error("Maximum 5 images allowed");
      return;
    }
    setNewImageFiles((p) => [...p, file]);
    setNewImagePreviews((p) => [...p, dataUrl]);
  };

  const deleteExistingImage = async (imageId: string) => {
    if (existingImages.length <= 1 && newImageFiles.length === 0) {
      toast.error("Pet must have at least 1 photo");
      return;
    }
    const { error } = await supabase.from("pet_images").delete().eq("id", imageId);
    if (error) {
      toast.error("Failed to delete image");
      return;
    }
    toast.success("Image deleted");
    queryClient.invalidateQueries({ queryKey: ["edit-pet", id] });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !id) return;
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
      sirePhotoFile ? validateImageFile(sirePhotoFile, { maxMb: 10, label: "Sire photo" }) : null,
      damPhotoFile ? validateImageFile(damPhotoFile, { maxMb: 10, label: "Dam photo" }) : null,
      validateBirthForm(birthForm),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setLoading(true);
    try {
      let sireUrl: string | undefined;
      let damUrl: string | undefined;
      if (sirePhotoFile) {
        const resized = await resizeImage(sirePhotoFile);
        sireUrl = await uploadRaw({
          bucket: "pet-photos",
          path: `${user.id}/${id}/sire-${Date.now()}.webp`,
          body: resized,
          contentType: "image/webp",
          upsert: true,
        });
      }
      if (damPhotoFile) {
        const resized = await resizeImage(damPhotoFile);
        damUrl = await uploadRaw({
          bucket: "pet-photos",
          path: `${user.id}/${id}/dam-${Date.now()}.webp`,
          body: resized,
          contentType: "image/webp",
          upsert: true,
        });
      }

      const { error: updErr } = await supabase
        .from("pets")
        .update({
          name: petName.trim(),
          species,
          breed: breed.trim(),
          age: age.trim(),
          color: color.trim(),
          weight: weight.trim(),
          notes: notes.trim(),
          microchip_number: microchipNumber.trim() || null,
          ...birthFormToPetPayload(birthForm, {
            sire_photo_url: sireUrl ?? pet?.sire_photo_url,
            dam_photo_url: damUrl ?? pet?.dam_photo_url,
          }),
        })
        .eq("id", id)
        .eq("owner_id", user.id);
      if (updErr) throw updErr;

      // Upload any new images — surface failures instead of silently dropping photos
      const startIndex = existingImages.length;
      let failedUploads = 0;
      for (let i = 0; i < newImageFiles.length; i++) {
        try {
          const file = newImageFiles[i];
          const resized = await resizeImage(file);
          const publicUrl = await uploadRaw({
            bucket: "pet-photos",
            path: `${user.id}/${id}/extra-${Date.now()}-${i}.webp`,
            body: resized,
            contentType: "image/webp",
            upsert: true,
          });
          const { error: imgErr } = await supabase.from("pet_images").insert({
            pet_id: id,
            image_url: publicUrl,
            sort_order: startIndex + i,
          });
          if (imgErr) throw imgErr;
        } catch {
          failedUploads++;
        }
      }

      if (failedUploads > 0) {
        toast.warning(`Pet details saved, but ${failedUploads} new photo(s) could not be uploaded. Please try adding them again.`);
      } else {
        toast.success("Pet updated successfully!");
      }
      queryClient.invalidateQueries({ queryKey: ["my-pets"] });
      queryClient.invalidateQueries({ queryKey: ["pet-profile", id] });
      navigate(mp("/dashboard"));
    } catch (err: any) {
      toast.error(err.message || "Failed to update pet");
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <main className="flex-1 bg-background p-8 flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </main>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className="flex min-h-screen">
        <DashboardSidebar />
        <main className="flex-1 bg-background p-8 text-center">
          <p className="text-muted-foreground">Pet not found or you don't have permission to edit it.</p>
          <Button asChild className="mt-4" variant="outline">
            <Link to={mp("/dashboard")}>Back to My Pets</Link>
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar />
      <main className="flex-1 bg-background p-6 md:p-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-2xl">
          <Button asChild variant="ghost" size="sm" className="mb-4 gap-2">
            <Link to={mp("/dashboard")}><ArrowLeft className="h-4 w-4" /> Back to My Pets</Link>
          </Button>
          <h1 className="font-display text-2xl font-bold text-foreground">Edit Pet</h1>
          <p className="text-sm text-muted-foreground">Update {pet.name}'s information</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pet Photos</CardTitle>
                <p className="text-sm text-muted-foreground">Up to 5 photos total. Click × to remove.</p>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-3">
                  {existingImages.map((img: any) => (
                    <div key={img.id} className="relative h-24 w-24 overflow-hidden rounded-lg border border-border">
                      <img src={img.image_url} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => deleteExistingImage(img.id)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
                        title="Delete photo"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {newImagePreviews.map((src, i) => (
                    <div key={`new-${i}`} className="relative h-24 w-24 overflow-hidden rounded-lg border-2 border-primary">
                      <img src={src} alt="" className="h-full w-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeNewImage(i)}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs text-destructive-foreground"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  {existingImages.length + newImagePreviews.length < 5 && (
                    <>
                      <button
                        type="button"
                        onClick={() => setWebcamOpen(true)}
                        className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary"
                      >
                        <Camera className="h-6 w-6" />
                        <span className="mt-1 text-xs">Take Photo</span>
                      </button>
                      <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border text-muted-foreground hover:border-primary hover:text-primary">
                        <Upload className="h-6 w-6" />
                        <span className="mt-1 text-xs">Upload</span>
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
                    <Input id="petName" required value={petName} onChange={(e) => setPetName(e.target.value)} />
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
                    <Input id="breed" value={breed} onChange={(e) => setBreed(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="age">Age</Label>
                    <Input id="age" value={age} onChange={(e) => setAge(e.target.value)} />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input id="color" value={color} onChange={(e) => setColor(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weight">Weight</Label>
                    <Input id="weight" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="microchip">Microchip Number</Label>
                  <Input id="microchip" value={microchipNumber} onChange={(e) => setMicrochipNumber(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Microchip is private — only used for searching.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <PetBirthFields
              values={birthForm}
              onChange={(patch) => setBirthForm((v) => ({ ...v, ...patch }))}
              myPets={myPets as any}
              sirePhotoPreview={sirePreview}
              damPhotoPreview={damPreview}
              onSirePhoto={(f) => { setSirePhotoFile(f); setSirePreview(URL.createObjectURL(f)); }}
              onDamPhoto={(f) => { setDamPhotoFile(f); setDamPreview(URL.createObjectURL(f)); }}
            />

            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate(mp("/dashboard"))}>
                Cancel
              </Button>
              <Button type="submit" size="lg" className="flex-1 gap-2" disabled={loading}>
                <PawPrint className="h-5 w-5" /> {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </motion.div>
        <WebcamCaptureDialog open={webcamOpen} onClose={() => setWebcamOpen(false)} onCapture={handleWebcamCapture} />
      </main>
    </div>
  );
};

export default EditPet;
