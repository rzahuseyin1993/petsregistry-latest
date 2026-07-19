import { useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Camera, HeartHandshake, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { uploadImage } from "@/lib/imageUpload";
import type { LostReportTipContext } from "@/lib/lostReportDisplay";
import { firstError, validateEmail, validateImageFile, validateOptionalLength, validatePhone, validateRequired } from "@/lib/validation";

interface Props {
  petId: string;
  petName: string;
  lostReport?: LostReportTipContext | null;
  trigger?: React.ReactNode;
}

/** Public "I Found This Pet" form — notifies the pet owner/reporter directly (in-app + email). */
const FoundPetTipDialog = ({ petId, petName, lostReport, trigger }: Props) => {
  const displayName = lostReport?.guestPetName?.trim() || petName;
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whereFound, setWhereFound] = useState("");
  const [details, setDetails] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [a] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [b] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captcha, setCaptcha] = useState("");
  const [sending, setSending] = useState(false);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setWhereFound("");
    setDetails("");
    setCaptcha("");
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const fileError = validateImageFile(file, { maxMb: 10, label: "Photo" });
    if (fileError) {
      toast.error(fileError);
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const submit = async () => {
    const validationError = firstError(
      validateRequired(name, "Your name", { min: 2, max: 100 }),
      validateEmail(email, { required: true }),
      validatePhone(phone),
      validateOptionalLength(whereFound, "Where you found the pet", 300),
      validateOptionalLength(details, "Details", 2000),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (parseInt(captcha, 10) !== a + b) {
      toast.error("Please solve the math question to confirm you're human");
      return;
    }

    setSending(true);
    try {
      let photoUrl: string | undefined;
      if (photoFile) {
        try {
          photoUrl = await uploadImage(photoFile, "pet-photos", "found-tip");
        } catch {
          toast.message("Photo upload failed — sending tip without photo");
        }
      }

      const { data, error } = await supabase.functions.invoke("found-pet-tip", {
        body: {
          petId,
          lostReportId: lostReport?.id ?? null,
          tipperName: name.trim(),
          tipperEmail: email.trim(),
          tipperPhone: phone.trim() || null,
          whereFound: whereFound.trim() || null,
          details: details.trim() || null,
          photoUrl: photoUrl ?? null,
          origin: window.location.origin,
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast.success("Thank you! Your message was sent directly to the pet owner.");
      setOpen(false);
      resetForm();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not send message. Please try again.";
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="default" className="gap-1.5 bg-success hover:bg-success/90 text-success-foreground">
            <HeartHandshake className="h-4 w-4" /> I Found This Pet
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>You found {displayName}? Thank you! 🙏</DialogTitle>
          <DialogDescription>
            Share what you know — your message goes <strong>directly to the pet owner</strong> by notification and email.
            The owner can contact you using the details you provide. Pet status will not change automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div>
            <Label htmlFor="ftn">Your name *</Label>
            <Input id="ftn" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fte">Email *</Label>
              <Input id="fte" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="ftp">Phone</Label>
              <Input id="ftp" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div>
            <Label htmlFor="ftw">Where did you find it?</Label>
            <Input id="ftw" placeholder="Street / area / landmark" value={whereFound} onChange={(e) => setWhereFound(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ftd">Details</Label>
            <Textarea id="ftd" rows={3} placeholder="What does it look like? Is it safe? Any injuries?" value={details} onChange={(e) => setDetails(e.target.value)} />
          </div>
          <div>
            <Label>Photo (optional)</Label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="relative mt-1.5 overflow-hidden rounded-lg border border-border">
                <img src={photoPreview} alt="Preview" className="max-h-40 w-full object-cover" />
                <Button
                  type="button"
                  variant="secondary"
                  size="icon"
                  className="absolute right-2 top-2 h-7 w-7"
                  onClick={clearPhoto}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="mt-1.5 w-full gap-2"
                onClick={() => photoInputRef.current?.click()}
              >
                <Camera className="h-4 w-4" /> Add a photo
              </Button>
            )}
          </div>
          <div>
            <Label htmlFor="ftc">Quick check: {a} + {b} = ?</Label>
            <Input id="ftc" inputMode="numeric" value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
          <Button onClick={submit} disabled={sending}>{sending ? "Sending…" : "Send to owner"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FoundPetTipDialog;
