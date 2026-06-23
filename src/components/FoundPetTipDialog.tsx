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

/** Public "I Found This Pet" form — notifies the pet owner directly (in-app + email). */
const FoundPetTipDialog = ({ petId, petName, trigger }: Props) => {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whereFound, setWhereFound] = useState("");
  const [details, setDetails] = useState("");
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
  };

  const submit = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please share your name and email so the owner can reach you");
      return;
    }
    if (parseInt(captcha, 10) !== a + b) {
      toast.error("Please solve the math question to confirm you're human");
      return;
    }

    setSending(true);
    try {
      const { data: petRow, error: petErr } = await supabase
        .from("pets")
        .select("owner_id, name")
        .eq("id", petId)
        .maybeSingle();
      if (petErr || !petRow?.owner_id) throw new Error("Could not find this pet's owner");

      const profileUrl = `${window.location.origin}/pet/${petId}`;
      const bodyLines = [
        details.trim() || "Someone reported finding your pet.",
        "",
        `Where: ${whereFound.trim() || "(not provided)"}`,
        `Profile: ${profileUrl}`,
      ];
      const fullMessage = bodyLines.join("\n");
      const contactLine = [name.trim(), email.trim(), phone.trim() ? `phone: ${phone.trim()}` : null]
        .filter(Boolean)
        .join(" · ");

      const { error: notifyErr } = await supabase.rpc("insert_system_notification", {
        _user_id: petRow.owner_id,
        _title: `🐾 Someone found ${petRow.name || petName}!`,
        _message: `From ${contactLine}\n\n${fullMessage.slice(0, 500)}`,
        _type: "lost_pet",
        _link: "/dashboard/inbox",
      });
      if (notifyErr) throw notifyErr;

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", petRow.owner_id)
        .maybeSingle();

      if (ownerProfile?.email) {
        const safe = (s: string) =>
          s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
        await supabase.functions.invoke("send-smtp-email", {
          body: {
            to: ownerProfile.email,
            subject: `🐾 Someone found ${petRow.name || petName}!`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#16a34a">Good news — someone may have found ${safe(petRow.name || petName)}</h2>
              <p><strong>From:</strong> ${safe(name.trim())}</p>
              <p><strong>Email:</strong> <a href="mailto:${safe(email.trim())}">${safe(email.trim())}</a></p>
              ${phone.trim() ? `<p><strong>Phone:</strong> ${safe(phone.trim())}</p>` : ""}
              ${whereFound.trim() ? `<p><strong>Where found:</strong> ${safe(whereFound.trim())}</p>` : ""}
              <div style="background:#f0fdf4;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${safe(details.trim() || "No extra details provided.")}</div>
              <p><a href="${safe(profileUrl)}">View pet profile</a></p>
              <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
            </div>`,
          },
        }).catch(() => {});
      }

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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>You found {petName}? Thank you! 🙏</DialogTitle>
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
