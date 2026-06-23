import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

interface ContactOwnerDialogProps {
  ownerId: string;
  petName: string;
  adoptionId: string;
  children?: React.ReactNode;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Adoption inquiry — anyone can message the owner to arrange an in-person meet-up. */
const ContactOwnerDialog = ({ ownerId, petName, adoptionId, children }: ContactOwnerDialogProps) => {
  const { user, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setName(profile?.full_name || "");
      setEmail(profile?.email || user.email || "");
      setPhone(profile?.phone || "");
    }
  }, [open, user, profile]);

  const resetForm = () => {
    setName("");
    setEmail("");
    setPhone("");
    setMessage("");
  };

  const handleSendMessage = async () => {
    if (!name.trim() || !email.trim()) {
      toast.error("Please enter your name and email so the owner can reply");
      return;
    }
    if (!message.trim()) {
      toast.error("Please write a message");
      return;
    }

    setSending(true);
    try {
      const contactLine = [name.trim(), email.trim(), phone.trim() ? `phone: ${phone.trim()}` : null]
        .filter(Boolean)
        .join(" · ");

      const { error: notifyErr } = await supabase.rpc("insert_system_notification", {
        _user_id: ownerId,
        _title: `Adoption inquiry for ${petName}`,
        _message: `From ${contactLine}\n\n${message.trim().slice(0, 500)}`,
        _type: "adoption",
        _link: "/dashboard/adoption",
      });
      if (notifyErr) throw notifyErr;

      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("user_id", ownerId)
        .maybeSingle();

      if (ownerProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", {
          body: {
            to: ownerProfile.email,
            subject: `Someone is interested in adopting ${petName}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#e11d48">🐾 Adoption inquiry for ${escapeHtml(petName)}</h2>
              <p>Hi ${escapeHtml(ownerProfile.full_name || "Pet Owner")},</p>
              <p>Someone would like to adopt <strong>${escapeHtml(petName)}</strong> and arrange a meet-up in person.</p>
              <p><strong>From:</strong> ${escapeHtml(name.trim())}</p>
              <p><strong>Email:</strong> <a href="mailto:${escapeHtml(email.trim())}">${escapeHtml(email.trim())}</a></p>
              ${phone.trim() ? `<p><strong>Phone:</strong> ${escapeHtml(phone.trim())}</p>` : ""}
              <div style="background:#fff1f2;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${escapeHtml(message.trim())}</div>
              <p>Reply to them directly to arrange where and when to meet. Listing ref: ${escapeHtml(adoptionId)}</p>
              <p style="margin-top:24px;color:#6b7280;font-size:13px">— Pets Registry</p>
            </div>`,
          },
        }).catch(() => {});
      }

      toast.success("Message sent to the pet owner!");
      setOpen(false);
      resetForm();
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" variant="outline" className="gap-2">
            <MessageCircle className="h-4 w-4" /> Contact Owner
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            Contact Owner — {petName}
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Send a message to arrange a meet-up in person. The owner will contact you using the details below.
        </p>

        <div className="space-y-3">
          <div>
            <Label htmlFor="adoption-contact-name">Your name *</Label>
            <Input
              id="adoption-contact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="adoption-contact-email">Email *</Label>
              <Input
                id="adoption-contact-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <Label htmlFor="adoption-contact-phone">Phone</Label>
              <Input
                id="adoption-contact-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="adoption-message">Your message *</Label>
            <Textarea
              id="adoption-message"
              placeholder={`Hi! I'm interested in adopting ${petName}. When and where could we meet?`}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              maxLength={1000}
            />
            <p className="mt-1 text-xs text-muted-foreground">{message.length}/1000</p>
          </div>
          <Button onClick={handleSendMessage} disabled={sending || !message.trim()} className="w-full gap-2">
            <MessageCircle className="h-4 w-4" />
            {sending ? "Sending..." : "Send to Owner"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactOwnerDialog;
