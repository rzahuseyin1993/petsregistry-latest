import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Baby, Plus, Trash2, ArrowLeft } from "lucide-react";
import PetBirthFields, { birthFormToPetPayload, emptyBirthForm, validateBirthForm } from "@/components/PetBirthFields";
import { resizeImage, uploadRaw } from "@/lib/imageUpload";
import { todayStr, validateDateNotFuture, validateImageFile } from "@/lib/validation";

type PuppyRow = {
  name: string;
  sex: string;
  color: string;
  birthWeight: string;
  imageFile: File | null;
  preview: string | null;
};

const LitterRegistration = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [litterDate, setLitterDate] = useState("");
  const [birthLocation, setBirthLocation] = useState("");
  const [breederName, setBreederName] = useState("");
  const [notes, setNotes] = useState("");
  const [birthForm, setBirthForm] = useState(emptyBirthForm);
  const [puppies, setPuppies] = useState<PuppyRow[]>([
    { name: "", sex: "", color: "", birthWeight: "", imageFile: null, preview: null },
  ]);

  const { data: myPets = [] } = useQuery({
    queryKey: ["my-pets-litter", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("pets")
        .select("id, name, pet_code, species")
        .eq("owner_id", user!.id)
        .order("name");
      return data || [];
    },
  });

  const addPuppy = () => {
    if (puppies.length >= 20) return toast.error("Maximum 20 puppies per litter");
    setPuppies((p) => [...p, { name: "", sex: "", color: "", birthWeight: "", imageFile: null, preview: null }]);
  };

  const updatePuppy = (index: number, patch: Partial<PuppyRow>) => {
    setPuppies((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const removePuppy = (index: number) => {
    if (puppies.length <= 1) return;
    setPuppies((rows) => rows.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (!litterDate) return toast.error("Litter date is required");
    const dateError = validateDateNotFuture(litterDate, "Litter date", { required: true });
    if (dateError) return toast.error(dateError);
    if (!birthForm.sirePetId && !birthForm.sireName) return toast.error("Sire (father) is required");
    if (!birthForm.damPetId && !birthForm.damName) return toast.error("Dam (mother) is required");
    const birthError = validateBirthForm(birthForm);
    if (birthError) return toast.error(birthError);
    const validPuppies = puppies.filter((p) => p.name.trim());
    if (validPuppies.length === 0) return toast.error("Add at least one puppy name");
    const names = validPuppies.map((p) => p.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return toast.error("Each puppy must have a unique name");
    for (const pup of validPuppies) {
      if (pup.name.trim().length > 100) return toast.error("Puppy names must be at most 100 characters");
      if (pup.imageFile) {
        const imgError = validateImageFile(pup.imageFile, { maxMb: 10, label: `Photo for "${pup.name.trim()}"` });
        if (imgError) return toast.error(imgError);
      }
    }

    setLoading(true);
    try {
      const { data: litter, error: litterErr } = await supabase.from("pet_litters" as any).insert({
        user_id: user.id,
        sire_pet_id: birthForm.sirePetId || null,
        dam_pet_id: birthForm.damPetId || null,
        sire_name: birthForm.sireName || null,
        dam_name: birthForm.damName || null,
        litter_date: litterDate,
        birth_location: birthLocation || birthForm.birthLocation || null,
        breeder_name: breederName || birthForm.breederName || null,
        puppy_count: validPuppies.length,
        notes: notes || null,
      }).select("id").single();
      if (litterErr) throw litterErr;

      const sharedBirth = birthFormToPetPayload({
        ...birthForm,
        dateOfBirth: litterDate,
        birthLocation: birthLocation || birthForm.birthLocation,
        breederName: breederName || birthForm.breederName,
      });

      for (let i = 0; i < validPuppies.length; i++) {
        const pup = validPuppies[i];
        const { data: pet, error: petErr } = await supabase.from("pets").insert({
          owner_id: user.id,
          name: pup.name.trim(),
          species: "Dog",
          color: pup.color || null,
          ...sharedBirth,
          sex: pup.sex || sharedBirth.sex,
          birth_weight: pup.birthWeight || sharedBirth.birth_weight,
          notes: notes ? `Litter ${litter.id}` : null,
        }).select("id").single();
        if (petErr) throw petErr;

        if (pup.imageFile) {
          const resized = await resizeImage(pup.imageFile);
          const publicUrl = await uploadRaw({
            bucket: "pet-photos",
            path: `${user.id}/${pet.id}/0.webp`,
            body: resized,
            contentType: "image/webp",
            upsert: true,
          });
          await supabase.from("pet_images").insert({ pet_id: pet.id, image_url: publicUrl, sort_order: 0 });
        }
      }

      toast.success(`Registered ${validPuppies.length} puppy(ies)! Create birth certificates from your dashboard.`);
      navigate("/dashboard/certificates");
    } catch (err: any) {
      toast.error(err.message || "Failed to register litter");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-auto p-6 max-w-3xl">
        <Button variant="ghost" size="sm" className="mb-4 gap-2" asChild>
          <Link to="/dashboard/certificates"><ArrowLeft className="h-4 w-4" /> Back to certificates</Link>
        </Button>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-2">
          <Baby className="h-6 w-6 text-primary" /> Register a Litter
        </h1>
        <p className="text-muted-foreground text-sm mb-6">
          Register multiple puppies with shared parents, then issue birth certificates for each ($15 each).
        </p>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Litter details</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>Litter / birth date *</Label>
                <Input type="date" max={todayStr()} value={litterDate} onChange={(e) => setLitterDate(e.target.value)} required />
              </div>
              <div>
                <Label>Birth location</Label>
                <Input value={birthLocation} onChange={(e) => setBirthLocation(e.target.value)} placeholder="Kennel, city" />
              </div>
              <div className="md:col-span-2">
                <Label>Breeder name</Label>
                <Input value={breederName} onChange={(e) => setBreederName(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <PetBirthFields
            values={birthForm}
            onChange={(patch) => setBirthForm((v) => ({ ...v, ...patch }))}
            myPets={myPets as any}
          />

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Puppies in this litter</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={addPuppy} className="gap-1">
                <Plus className="h-4 w-4" /> Add puppy
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {puppies.map((pup, idx) => (
                <div key={idx} className="rounded-lg border p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">Puppy {idx + 1}</span>
                    {puppies.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => removePuppy(idx)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Name *</Label>
                      <Input value={pup.name} onChange={(e) => updatePuppy(idx, { name: e.target.value })} />
                    </div>
                    <div>
                      <Label>Sex</Label>
                      <Input value={pup.sex} onChange={(e) => updatePuppy(idx, { sex: e.target.value })} placeholder="M / F" />
                    </div>
                    <div>
                      <Label>Color</Label>
                      <Input value={pup.color} onChange={(e) => updatePuppy(idx, { color: e.target.value })} />
                    </div>
                    <div>
                      <Label>Weight at birth</Label>
                      <Input value={pup.birthWeight} onChange={(e) => updatePuppy(idx, { birthWeight: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Label>Photo (optional)</Label>
                      <Input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          updatePuppy(idx, { imageFile: file, preview: URL.createObjectURL(file) });
                        }}
                      />
                      {pup.preview && <img src={pup.preview} alt="" className="h-16 w-16 rounded mt-2 object-cover" />}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <div>
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>

          <Button type="submit" disabled={loading} className="w-full">
            {loading ? "Registering…" : "Register litter & puppies"}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default LitterRegistration;
