import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { MessageCircle, Phone, Mail, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface ContactOwnerDialogProps {
  ownerId: string;
  petName: string;
  adoptionId: string;
  children?: React.ReactNode;
}

const ContactOwnerDialog = ({ ownerId, petName, adoptionId, children }: ContactOwnerDialogProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  // Fetch owner's public profile to check if they share contact info
  const { data: ownerProfile } = useQuery({
    queryKey: ["owner-profile", ownerId],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_public_profile", { _user_id: ownerId });
      return data as any;
    },
    enabled: open,
  });

  const handleSendMessage = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    if (!message.trim()) { toast.error("Please write a message"); return; }
    
    setSending(true);
    try {
      // Send in-app notification to owner
      await supabase.rpc("insert_system_notification", {
        _user_id: ownerId,
        _title: `Message about ${petName}`,
        _message: message.trim(),
        _type: "adoption",
        _link: "/dashboard/adoption",
      });

      // Also send email if owner has email
      if (ownerProfile?.email) {
        const { data: senderProfile } = await supabase
          .from("profiles")
          .select("full_name, email, phone")
          .eq("user_id", user.id)
          .single();

        await supabase.functions.invoke("send-smtp-email", {
          body: {
            to: ownerProfile.email,
            subject: `Someone is interested in adopting ${petName}`,
            html: `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                <h2 style="color:#e11d48">🐾 Adoption Inquiry for ${petName}</h2>
                <p><strong>From:</strong> ${senderProfile?.full_name || "A member"} (${senderProfile?.email || user.email})</p>
                ${senderProfile?.phone ? `<p><strong>Phone:</strong> ${senderProfile.phone}</p>` : ""}
                <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0">
                  <p style="margin:0;white-space:pre-wrap">${message.trim()}</p>
                </div>
                <p>Log in to your <strong>Adoption Manager</strong> to respond.</p>
                <p style="margin-top:24px;color:#6b7280;font-size:13px">— Pet Registry Team</p>
              </div>
            `,
          },
        }).catch(() => {});
      }

      toast.success("Message sent to the pet owner!");
      setMessage("");
      setOpen(false);
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

        <div className="space-y-4">
          {/* Show owner contact details if they opted in */}
          {ownerProfile && (ownerProfile.show_name || ownerProfile.show_phone) && (
            <div className="rounded-lg border border-border bg-muted/50 p-4 space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Owner Contact Info</p>
              {ownerProfile.show_name && ownerProfile.full_name && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <User className="h-4 w-4 text-muted-foreground" /> {ownerProfile.full_name}
                </div>
              )}
              {ownerProfile.show_phone && ownerProfile.phone && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a href={`tel:${ownerProfile.phone}`} className="text-primary hover:underline">{ownerProfile.phone}</a>
                </div>
              )}
              {ownerProfile.email && (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <a href={`mailto:${ownerProfile.email}`} className="text-primary hover:underline">{ownerProfile.email}</a>
                </div>
              )}
            </div>
          )}

          {/* Message form */}
          {user ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="adoption-message">Send a message</Label>
                <Textarea
                  id="adoption-message"
                  placeholder={`Hi! I'm interested in adopting ${petName}. I'd love to learn more about them...`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={4}
                  className="mt-1"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground mt-1">{message.length}/1000</p>
              </div>
              <Button onClick={handleSendMessage} disabled={sending || !message.trim()} className="w-full gap-2">
                <MessageCircle className="h-4 w-4" />
                {sending ? "Sending..." : "Send Message"}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">Sign in to contact the owner</p>
              <Button asChild variant="outline">
                <a href="/login">Sign In</a>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ContactOwnerDialog;
