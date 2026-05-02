import { useParams, useLocation, Link } from "react-router-dom";
import ProtectedImage from "@/components/ProtectedImage";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MembershipBadge from "@/components/MembershipBadge";
import { Mail, Phone, User, Calendar, Palette, Weight, QrCode, Shield, CheckCircle, Cpu, Download, MessageCircle, Lock, Crown, AlertTriangle, MapPin, Gift, HeartHandshake } from "lucide-react";
import FoundPetTipDialog from "@/components/FoundPetTipDialog";
import { QRCodeSVG } from "qrcode.react";
import { motion } from "framer-motion";
import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const QR_DOWNLOAD_SIZES = [
  { label: "0.5cm × 0.5cm", cmSize: 0.5, pxSize: 59 },
  { label: "1cm × 1cm", cmSize: 1, pxSize: 118 },
  { label: "2cm × 2cm", cmSize: 2, pxSize: 236 },
  { label: "3cm × 3cm", cmSize: 3, pxSize: 354 },
];

const downloadQrCode = (petName: string, pxSize: number, label: string) => {
  // Grab the rendered QR SVG from the page
  const svgEl = document.querySelector(".qr-code-container svg") as SVGSVGElement | null;
  if (!svgEl) return;

  const padding = Math.round(pxSize * 0.1);
  const totalSize = pxSize + padding * 2;
  const canvas = document.createElement("canvas");
  canvas.width = totalSize;
  canvas.height = totalSize;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalSize, totalSize);

  const svgClone = svgEl.cloneNode(true) as SVGSVGElement;
  svgClone.setAttribute("width", String(pxSize));
  svgClone.setAttribute("height", String(pxSize));
  const svgData = new XMLSerializer().serializeToString(svgClone);
  const img = new Image();
  img.onload = () => {
    ctx.drawImage(img, padding, padding, pxSize, pxSize);
    const link = document.createElement("a");
    link.download = `${petName}-qr-${label.replace(/\s/g, "")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
};
import { useQuery } from "@tanstack/react-query";

const PetProfile = () => {
  const { id, petId } = useParams();
  const resolvedId = petId || id;
  const location = useLocation();
  const isMobile = location.pathname.startsWith("/m/");
  const [activeImage, setActiveImage] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const { user, loading: authLoading } = useAuth();
  const { data: siteUrl } = useQuery({
    queryKey: ["site-url"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "site_url").single();
      return data?.value || window.location.origin;
    },
    staleTime: Infinity,
  });

  // Check if current viewer has an active membership
  const { data: viewerMembership } = useQuery({
    queryKey: ["viewer-membership", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });
  const isMember = !!viewerMembership;

  const { data: pet, isLoading } = useQuery({
    queryKey: ["pet-profile", resolvedId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pets_public" as any)
        .select("*, pet_images(image_url, sort_order)")
        .eq("id", resolvedId!)
        .single();
      if (error) throw error;

      const petData = data as any;
      const isOwner = user?.id === petData.owner_id;
      let microchip_number: string | null = null;
      let canDownloadQr = false;

      if (isOwner) {
        const { data: ownedPet } = await supabase
          .from("pets")
          .select("id, microchip_number")
          .eq("id", resolvedId!)
          .maybeSingle();

        if (ownedPet) {
          microchip_number = ownedPet.microchip_number || null;
          canDownloadQr = true;
        }
      }

      // Owner contact info ONLY for the owner themselves
      let ownerProfile = null;
      if (isOwner) {
        const { data: ownerProfileJson } = await supabase.rpc("get_public_profile", { _user_id: petData.owner_id });
        ownerProfile = ownerProfileJson as { full_name: string | null; email: string; phone: string | null; show_name: boolean; show_phone: boolean } | null;
      }
      // Membership badge is non-PII and shown to everyone
      const { data: membership } = await supabase
        .from("memberships")
        .select("*, membership_plans(name, plan_type, badge_icon_url)")
        .eq("user_id", petData.owner_id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString())
        .limit(1)
        .maybeSingle();
      return { ...petData, microchip_number, owner: ownerProfile, ownerMembership: membership, canDownloadQr, isOwner };
    },
  });

  // Fetch active or recently-found lost report (public-readable view)
  const { data: lostReport, refetch: refetchLostReport } = useQuery({
    queryKey: ["pet-lost-report", resolvedId],
    queryFn: async () => {
      const { data } = await supabase
        .from("lost_reports_public" as any)
        .select("*")
        .eq("pet_id", resolvedId!)
        .in("status", ["active", "found"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    enabled: !!resolvedId,
  });

  const isReporter = !!user && !!lostReport && user.id === lostReport.reporter_id;
  const isFoundReport = lostReport?.status === "found";

  const handleMarkFound = async () => {
    if (!lostReport) return;
    if (!confirm("Mark this pet as FOUND? It will stay visible as 'Found' for a few days then be auto-removed.")) return;
    const { error: e1 } = await supabase
      .from("lost_reports")
      .update({ status: "found", updated_at: new Date().toISOString() })
      .eq("id", lostReport.id);
    if (e1) { toast.error("Could not update report"); return; }
    await supabase.from("pets").update({ status: "found" }).eq("id", resolvedId!);
    toast.success("Marked as Found! 🎉 Thank you for the update.");
    refetchLostReport();
  };

  const handleSendContact = async () => {
    if (!user) { toast.error("Please sign in first"); return; }
    if (!message.trim()) { toast.error("Please write a message"); return; }
    setSending(true);
    try {
      await supabase.rpc("insert_system_notification", {
        _user_id: (pet as any).owner_id,
        _title: `Message about ${pet.name}`,
        _message: message.trim(),
        _type: "info",
        _link: `/pet/${resolvedId}`,
      });
      toast.success("Message sent to the owner!");
      setMessage("");
      setContactOpen(false);
    } catch {
      toast.error("Failed to send message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const profileUrl = `${siteUrl || window.location.origin}/pet/${resolvedId}`;

  const statusStyles: Record<string, string> = {
    registered: "bg-success/10 text-success border-success/20",
    lost: "bg-destructive/10 text-destructive border-destructive/20",
    found: "bg-accent/10 text-accent border-accent/20",
  };

  if (isLoading) {
    return (
      <div className={isMobile ? "flex flex-1 items-center justify-center py-20" : "flex min-h-screen flex-col bg-background"}>
        {!isMobile && <Navbar />}
        <div className="flex flex-1 items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!pet) {
    return (
      <div className={isMobile ? "flex flex-1 items-center justify-center py-20" : "flex min-h-screen flex-col bg-background"}>
        {!isMobile && <Navbar />}
        <div className="flex flex-1 items-center justify-center">
          <p className="text-lg text-muted-foreground">Pet not found.</p>
        </div>
        {!isMobile && <Footer />}
      </div>
    );
  }

  const images = (pet.pet_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const owner = pet?.owner;

  return (
    <div className={isMobile ? "" : "flex min-h-screen flex-col bg-background"}>
      {!isMobile && <Navbar />}
      <main className={isMobile ? "px-4 py-4" : "flex-1 py-8"}>
        <div className="container max-w-4xl">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            {/* Verified badge */}
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <CheckCircle className="h-4 w-4 text-success" />
              <span className="text-sm font-medium text-foreground">Verified Pet Profile</span>
              <span className="text-xs font-mono font-semibold text-primary">{(pet as any).pet_code || pet.id.slice(0, 10).toUpperCase()}</span>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              {/* Images - Main + Thumbnails side by side */}
              <div className="lg:col-span-2">
                {images.length > 0 && (
                  <div className="flex gap-3">
                    {/* Main image */}
                    <div className="flex-1 overflow-hidden rounded-2xl shadow-md bg-muted">
                      <ProtectedImage
                        src={images[activeImage]?.image_url}
                        alt={pet.name}
                        className="w-full max-h-[500px] object-contain"
                      />
                    </div>
                    {/* Thumbnail strip on the right */}
                    {images.length > 1 && (
                      <div className="flex w-20 flex-col gap-2 md:w-24">
                        {images.slice(0, 5).map((img: any, i: number) => (
                          <button
                            key={i}
                            onClick={() => setActiveImage(i)}
                            className={`overflow-hidden rounded-xl border-2 transition-all ${
                              i === activeImage
                                ? "border-primary ring-2 ring-primary/30"
                                : "border-transparent hover:border-muted-foreground/30"
                            }`}
                          >
                            <img
                              src={img.image_url}
                              alt={`${pet.name} photo ${i + 1}`}
                              className="aspect-square w-full object-cover"
                            />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Details Card */}
                <Card className="mt-6 border-border">
                  <CardContent className="p-5">
                    <div className="flex items-center gap-3 mb-4 flex-wrap">
                      <h1 className="font-display text-3xl font-bold text-foreground">{pet.name}</h1>
                      {lostReport && !isFoundReport ? (
                        <Badge variant="outline" className={statusStyles.lost}>
                          <AlertTriangle className="mr-1 h-3 w-3" /> Lost
                        </Badge>
                      ) : isFoundReport ? (
                        <Badge variant="outline" className={statusStyles.found}>
                          <CheckCircle className="mr-1 h-3 w-3" /> Found · Reunited
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={statusStyles[pet.status]}>{pet.status}</Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {pet.age && <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm"><Calendar className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Age:</span><span className="font-medium">{pet.age}</span></div>}
                      {pet.color && <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm"><Palette className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Color:</span><span className="font-medium">{pet.color}</span></div>}
                      {pet.weight && <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm"><Weight className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Weight:</span><span className="font-medium">{pet.weight}</span></div>}
                      {pet.microchip_number && <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm"><Cpu className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Microchip:</span><span className="font-medium font-mono">{pet.microchip_number}</span></div>}
                      <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-sm"><QrCode className="h-4 w-4 text-primary" /><span className="text-muted-foreground">Pet ID:</span><span className="font-medium font-mono text-primary">{(pet as any).pet_code || pet.id.slice(0, 10).toUpperCase()}</span></div>
                    </div>

                    {/* Active Lost / recently-Found Report panel — visible to everyone */}
                    {lostReport && (
                      <div className={`mt-5 rounded-xl border p-4 ${isFoundReport ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
                        <div className="flex items-center gap-2 mb-3">
                          {isFoundReport ? (
                            <CheckCircle className="h-5 w-5 text-success" />
                          ) : (
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                          )}
                          <h3 className={`font-display font-semibold ${isFoundReport ? "text-success" : "text-destructive"}`}>
                            {isFoundReport ? "Great news — this pet has been found! 🎉" : "This pet is currently reported lost"}
                          </h3>
                        </div>
                        {lostReport.description && (
                          <p className="text-sm text-foreground/90 mb-3">{lostReport.description}</p>
                        )}
                        <div className="space-y-2">
                          {(lostReport.last_seen_address || (lostReport.last_seen_lat && lostReport.last_seen_lng)) && (
                            <div className="flex items-start gap-2 text-sm">
                              <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${isFoundReport ? "text-success" : "text-destructive"}`} />
                              <div>
                                <span className="text-muted-foreground">Last seen: </span>
                                <span className="font-medium">
                                  {lostReport.last_seen_address ||
                                    `${Number(lostReport.last_seen_lat).toFixed(5)}, ${Number(lostReport.last_seen_lng).toFixed(5)}`}
                                </span>
                              </div>
                            </div>
                          )}
                          {lostReport.reward && !isFoundReport && (
                            <div className="flex items-center gap-2 text-sm">
                              <Gift className="h-4 w-4 shrink-0 text-accent" />
                              <span className="text-muted-foreground">Reward: </span>
                              <span className="font-semibold text-accent">{lostReport.reward}</span>
                            </div>
                          )}
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2">
                          {((lostReport.last_seen_lat && lostReport.last_seen_lng) || lostReport.last_seen_address) && (
                            <a
                              href={
                                lostReport.last_seen_lat && lostReport.last_seen_lng
                                  ? `https://www.google.com/maps?q=${lostReport.last_seen_lat},${lostReport.last_seen_lng}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lostReport.last_seen_address)}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary transition hover:bg-primary/10"
                            >
                              <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
                            </a>
                          )}

                          {!isFoundReport && (
                            <FoundPetTipDialog petId={resolvedId!} petName={pet.name} />
                          )}

                          {!isFoundReport && isReporter && (
                            <Button
                              onClick={handleMarkFound}
                              variant="outline"
                              className="gap-1.5 border-success/40 text-success hover:bg-success/10"
                            >
                              <CheckCircle className="h-4 w-4" /> Mark as Found
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-5">
                {/* Public QR Code — visible to everyone so anyone can rescan/share the profile */}
                <Card className="border-border">
                  <CardContent className="flex flex-col items-center p-6">
                    <h3 className="mb-4 font-display font-semibold text-foreground">Pet QR Code</h3>
                    <div className="qr-code-container rounded-2xl border border-border bg-card p-4">
                      <QRCodeSVG value={profileUrl} size={160} />
                    </div>
                    <p className="mt-3 text-center text-xs text-muted-foreground">Scan to view this pet's profile</p>
                    <p className="mt-1 text-center text-xs font-mono font-semibold text-primary break-all">{(pet as any).pet_code || pet.id.toUpperCase()}</p>
                    {!authLoading && (pet as any)?.canDownloadQr && (
                      <div className="mt-4 w-full space-y-2">
                        <p className="text-center text-xs font-medium text-muted-foreground">Download for pet tag</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          {QR_DOWNLOAD_SIZES.map((s) => (
                            <Button
                              key={s.label}
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-xs"
                              onClick={() => downloadQrCode(pet.name, s.pxSize, s.label)}
                            >
                              <Download className="h-3 w-3" /> {s.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {(pet as any)?.isOwner ? (
                  <>

                    {owner && (
                      <Card className="border-border">
                        <CardContent className="p-5">
                          <h3 className="mb-3 font-display font-semibold text-foreground">Owner Info</h3>
                          {pet.ownerMembership && (pet.ownerMembership as any).membership_plans && (
                            <div className="mb-3">
                              <MembershipBadge
                                planType={(pet.ownerMembership as any).membership_plans.plan_type}
                                planName={(pet.ownerMembership as any).membership_plans.name}
                                badgeIconUrl={(pet.ownerMembership as any).membership_plans.badge_icon_url}
                                size="sm"
                              />
                            </div>
                          )}
                          <div className="space-y-2.5">
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="h-4 w-4 text-primary" />
                              <span className="font-medium text-primary">{owner.email}</span>
                            </div>
                            {owner.show_name && owner.full_name && (
                              <div className="flex items-center gap-2 text-sm"><User className="h-4 w-4 text-muted-foreground" /><span>{owner.full_name}</span></div>
                            )}
                            {owner.show_phone && owner.phone && (
                              <div className="flex items-center gap-2 text-sm"><Phone className="h-4 w-4 text-muted-foreground" /><span>{owner.phone}</span></div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                ) : (
                  <>
                    {/* Owner membership badge - public-safe, no PII */}
                    {pet.ownerMembership && (pet.ownerMembership as any).membership_plans && (
                      <Card className="border-border">
                        <CardContent className="p-4 flex items-center justify-center">
                          <MembershipBadge
                            planType={(pet.ownerMembership as any).membership_plans.plan_type}
                            planName={(pet.ownerMembership as any).membership_plans.name}
                            badgeIconUrl={(pet.ownerMembership as any).membership_plans.badge_icon_url}
                            size="sm"
                          />
                        </CardContent>
                      </Card>
                    )}

                    {/* Contact Owner button - logged-in users can message; email never shown */}
                    <Card className="border-border">
                      <CardContent className="p-5 text-center space-y-3">
                        <Shield className="mx-auto h-8 w-8 text-primary/60" />
                        <h3 className="font-display font-semibold text-foreground">Contact the Owner</h3>
                        <p className="text-xs text-muted-foreground">
                          Send a private message about {pet.name}. The owner's email is never shared.
                        </p>
                        {user ? (
                          <Dialog open={contactOpen} onOpenChange={setContactOpen}>
                            <DialogTrigger asChild>
                              <Button className="w-full gap-2">
                                <MessageCircle className="h-4 w-4" /> Contact Owner
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-md">
                              <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                  <MessageCircle className="h-5 w-5 text-primary" />
                                  Message the owner of {pet.name}
                                </DialogTitle>
                              </DialogHeader>
                              <div className="space-y-3">
                                <Label htmlFor="owner-msg">Your message</Label>
                                <Textarea
                                  id="owner-msg"
                                  placeholder={`Hi! I'd like to ask about ${pet.name}…`}
                                  value={message}
                                  onChange={(e) => setMessage(e.target.value)}
                                  rows={4}
                                  maxLength={1000}
                                />
                                <p className="text-xs text-muted-foreground">{message.length}/1000</p>
                                <Button onClick={handleSendContact} disabled={sending || !message.trim()} className="w-full gap-2">
                                  <MessageCircle className="h-4 w-4" />
                                  {sending ? "Sending..." : "Send Message"}
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        ) : (
                          <Button asChild className="w-full">
                            <Link to="/login">Sign in to contact</Link>
                          </Button>
                        )}
                      </CardContent>
                    </Card>

                    {/* Membership upsell for non-members */}
                    {!isMember && (
                      <Card className="border-accent/30 bg-accent/5">
                        <CardContent className="p-5 text-center space-y-2">
                          <Crown className="mx-auto h-8 w-8 text-accent" />
                          <h3 className="font-display font-semibold text-foreground">Become a Member</h3>
                          <p className="text-xs text-muted-foreground">
                            {user
                              ? "Unlock full pet profile features and reach more owners."
                              : "Sign up and become a member to access more pet information."}
                          </p>
                          <Button asChild size="sm" variant="default" className="w-full gap-1.5">
                            <Link to="/membership">
                              <Crown className="h-3.5 w-3.5" /> View Membership
                            </Link>
                          </Button>
                          <p className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground">
                            <Lock className="h-3 w-3" /> Microchip is always private — only searchable
                          </p>
                        </CardContent>
                      </Card>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </main>
      {!isMobile && <Footer />}
    </div>
  );
};

export default PetProfile;
