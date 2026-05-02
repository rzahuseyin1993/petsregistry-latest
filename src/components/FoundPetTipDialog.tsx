import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HeartHandshake } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  petId: string;
  petName: string;
  trigger?: React.ReactNode;
}

/**
 * Public "I Found This Pet" tip form.
 * Anyone (logged-in or not) can submit a sighting; it lands in the admin
 * Contact Submissions inbox tagged as a found-pet tip. Admin verifies & contacts the owner.
 * No status change is made directly — prevents abuse.
 */
const FoundPetTipDialog = ({ petId, petName, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whereFound, setWhereFound] = useState("");
  const [details, setDetails] = useState("");
  // Tiny human-check
  const [a] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [b] = useState(() => Math.floor(Math.random() * 8) + 2);
  const [captcha, setCaptcha] = useState("");
  const [sending, setSending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please share your name and email so we can connect you with the owner");
      return;
    }
    if (parseInt(captcha, 10) !== a + b) {
      toast.error("Please solve the math question to confirm you're human");
      return;
    }

    setSending(true);
    const message = [
      `Pet: ${petName} (id: ${petId})`,
      `Profile: ${window.location.origin}/pet/${petId}`,
      ``,
      `Where found: ${whereFound || "(not provided)"}`,
      `Details: ${details || "(none)"}`,
      ``,
      `Reporter phone: ${phone || "(not provided)"}`,
    ].join("\n");

    const { error } = await supabase.from("contact_submissions").insert({
      name: name.trim(),
      email: email.trim(),
      subject: `🐾 Found-pet tip for ${petName}`,
      message,
      source: "found_pet_tip",
    });
    setSending(false);

    if (error) {
      toast.error("Could not send tip. Please try again.");
      return;
    }
    toast.success("Thank you! Admin will verify and connect you with the owner.");
    setOpen(false);
    setName(""); setEmail(""); setPhone(""); setWhereFound(""); setDetails(""); setCaptcha("");
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>You found {petName}? Thank you! 🙏</DialogTitle>
          <DialogDescription>
            Share what you know — admin will verify your tip and put you in touch with the owner. To protect against abuse, status will not change automatically.
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
            <Label htmlFor="ftc">Quick check: {a} + {b} = ?</Label>
            <Input id="ftc" inputMode="numeric" value={captcha} onChange={(e) => setCaptcha(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Cancel</Button>
          <Button onClick={submit} disabled={sending}>{sending ? "Sending…" : "Send tip"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FoundPetTipDialog;
