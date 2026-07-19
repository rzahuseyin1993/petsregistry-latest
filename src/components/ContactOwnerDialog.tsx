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
import { firstError, validateEmail, validatePhone, validateRequired } from "@/lib/validation";

interface ContactOwnerDialogProps {
  ownerId: string;
  petName: string;
  adoptionId: string;
  children?: React.ReactNode;
}

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
    const validationError = firstError(
      validateRequired(name, "Your name", { min: 2, max: 100 }),
      validateEmail(email, { required: true }),
      validatePhone(phone),
      validateRequired(message, "Message", { min: 5, max: 1000 }),
    );
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setSending(true);
    try {
      // Route through the trusted edge function (notify + email happen server-side).
      const { data, error } = await supabase.functions.invoke("owner-messaging", {
        body: {
          action: "adoption_inquiry",
          adoptionId,
          senderName: name.trim(),
          senderEmail: email.trim(),
          senderPhone: phone.trim(),
          message: message.trim(),
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

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
