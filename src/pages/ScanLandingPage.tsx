import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, MapPin, MessageCircle, ShieldCheck, QrCode, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedImage from "@/components/ProtectedImage";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ScanLandingPage = () => {
  const { petId } = useParams<{ petId: string }>();
  const { user } = useAuth();
  const [phase, setPhase] = useState<"locating" | "ready">("locating");
  const [pet, setPet] = useState<any>(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderContact, setSenderContact] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!petId) return;

    const loadPet = async () => {
      const { data } = await supabase
        .from("pets_public" as any)
        .select("*, pet_images(image_url, sort_order)")
        .eq("id", petId)
        .maybeSingle();
      setPet(data);
    };
    loadPet();

    const sendLocation = (lat: number | null, lng: number | null) => {
      // 1. Insert scan log (anon-allowed)
      supabase.from("pet_scan_logs" as any).insert({
        pet_id: petId,
        scanner_user_id: user?.id ?? null,
        lat, lng,
        user_agent: navigator.userAgent.slice(0, 200),
      }).then(() => {});
      // 2. Notify owner
      supabase.functions.invoke("scan-notify", {
        body: { petId, lat, lng },
      }).catch((e) => console.error("notify failed", e))
        .finally(() => setPhase("ready"));
    };

    if (!navigator.geolocation) {
      sendLocation(null, null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => sendLocation(pos.coords.latitude, pos.coords.longitude),
      () => sendLocation(null, null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }, [petId, user?.id]);

  const handleSendContact = async () => {
    if (!petId || !msg.trim()) { toast.error("Please write a message"); return; }
    if (!senderName.trim() || !senderContact.trim()) { toast.error("Name and contact required"); return; }
    setSending(true);
    try {
      const { data: petRow } = await supabase.from("pets").select("owner_id, name").eq("id", petId).maybeSingle();
      if (!petRow) throw new Error("Pet not found");

      await supabase.rpc("insert_system_notification", {
        _user_id: petRow.owner_id,
        _title: `📩 Someone found ${petRow.name}!`,
        _message: `From ${senderName} (${senderContact}): ${msg.slice(0, 200)}`,
        _type: "scan",
        _link: `/pet/${petId}`,
      });

      // Email the owner via SMTP function
      const { data: ownerProfile } = await supabase
        .from("profiles").select("email, full_name").eq("user_id", petRow.owner_id).maybeSingle();
      if (ownerProfile?.email) {
        await supabase.functions.invoke("send-smtp-email", {
          body: {
            to: ownerProfile.email,
            subject: `🐾 Someone found ${petRow.name}!`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
              <h2 style="color:#dc2626">Someone scanned ${petRow.name}'s tag and wants to contact you</h2>
              <p><strong>Name:</strong> ${senderName}</p>
              <p><strong>Contact:</strong> ${senderContact}</p>
              <div style="background:#f9fafb;border-radius:8px;padding:16px;margin:16px 0;white-space:pre-wrap">${msg.trim()}</div>
              <p style="color:#6b7280;font-size:13px;margin-top:24px">— Pets Registry</p>
            </div>`,
          },
        }).catch(() => {});
      }

      toast.success("Owner has been notified — thank you!");
      setContactOpen(false);
      setMsg(""); setSenderName(""); setSenderContact("");
    } catch (e: any) {
      toast.error(e.message || "Failed to contact owner");
    } finally {
      setSending(false);
    }
  };

  const img = pet?.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container max-w-xl">
          {phase === "locating" ? (
            <Card>
              <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <h2 className="font-display text-xl font-bold text-foreground">Sending location to owner...</h2>
                <p className="max-w-sm text-sm text-muted-foreground">
                  Please tap <strong>Allow</strong> if your browser asks for location access. This helps the owner find their pet.
                </p>
              </CardContent>
            </Card>
          ) : pet ? (
            <>
              <Card className="overflow-hidden">
                {img && <ProtectedImage src={img.image_url} alt={pet.name} className="aspect-[4/3] w-full object-cover" />}
                <CardContent className="p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h1 className="font-display text-2xl font-bold text-foreground">{pet.name}</h1>
                      <p className="text-sm text-muted-foreground">
                        {pet.species}{pet.breed ? ` · ${pet.breed}` : ""}{pet.color ? ` · ${pet.color}` : ""}
                      </p>
                      {pet.pet_code && <p className="mt-1 text-xs text-muted-foreground">ID: {pet.pet_code}</p>}
                    </div>
                    {pet.status === "lost" ? (
                      <Badge variant="destructive">Lost</Badge>
                    ) : (
                      <Badge className="bg-success/10 text-success">
                        <ShieldCheck className="mr-1 h-3 w-3" /> Registered
                      </Badge>
                    )}
                  </div>

                  <div className="mt-4 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                    <p className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" />
                      The owner has been notified that this tag was scanned.
                    </p>
                  </div>

                  <Button className="mt-4 w-full gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => setContactOpen(true)}>
                    <MessageCircle className="h-4 w-4" /> Contact Owner
                  </Button>

                  <p className="mt-3 text-center text-xs text-muted-foreground">
                    The owner's phone & email are private. Your message goes to them directly.
                  </p>
                </CardContent>
              </Card>

              {/* CTA for non-members */}
              {!user && (
                <Card className="mt-4 border-primary/30 bg-primary/5">
                  <CardContent className="flex items-start gap-3 p-5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <QrCode className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-foreground">Keep your own pets safe too</h3>
                      <p className="text-sm text-muted-foreground">Register for a free QR tag today.</p>
                    </div>
                    <Button asChild size="sm">
                      <Link to="/register">Register Free</Link>
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <Heart className="mx-auto h-10 w-10 text-muted-foreground" />
                <h2 className="mt-3 font-display text-lg font-bold">Pet not found</h2>
                <p className="mt-1 text-sm text-muted-foreground">This QR tag is not linked to a registered pet.</p>
                <Button asChild className="mt-4"><Link to="/">Go home</Link></Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={contactOpen} onOpenChange={setContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Contact {pet?.name}'s owner</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div>
              <Label>Your name</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
            </div>
            <div>
              <Label>Phone or email so they can reach you</Label>
              <Input value={senderContact} onChange={(e) => setSenderContact(e.target.value)} />
            </div>
            <div>
              <Label>Message</Label>
              <Textarea rows={4} value={msg} onChange={(e) => setMsg(e.target.value)}
                placeholder={`I think I found ${pet?.name}! They're safe with me at...`} maxLength={1000} />
            </div>
            <Button className="w-full" onClick={handleSendContact} disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-2 h-4 w-4" />}
              Send to Owner
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default ScanLandingPage;
