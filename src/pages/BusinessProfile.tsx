import { useParams, Link, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MapPin, Phone, Globe, Mail, Star, ArrowLeft, Building2, MessageCircle, Video, X as XIcon } from "lucide-react";
import { useState } from "react";

/** Extract a YouTube embed URL from various link formats */
const getYouTubeEmbedUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtube.com") && u.searchParams.get("v")) {
      return `https://www.youtube.com/embed/${u.searchParams.get("v")}`;
    }
    if (u.hostname === "youtu.be") {
      return `https://www.youtube.com/embed${u.pathname}`;
    }
  } catch {}
  return null;
};

const getFacebookEmbedUrl = (url: string): string | null => {
  try {
    const u = new URL(url);
    if (u.hostname.includes("facebook.com") || u.hostname.includes("fb.watch")) {
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url)}&show_text=false`;
    }
  } catch {}
  return null;
};

const BusinessProfile = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const isMobile = location.pathname.startsWith("/m/");
  const directoryLink = isMobile ? "/m/directory" : "/directory";

  const { data: listing, isLoading } = useQuery({
    queryKey: ["business-listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_listings")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: images = [] } = useQuery({
    queryKey: ["business-listing-images", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_listing_images")
        .select("*")
        .eq("listing_id", id!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: ownerProfile } = useQuery({
    queryKey: ["listing-owner", listing?.owner_id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, email, phone, show_name, show_phone")
        .eq("user_id", listing!.owner_id)
        .single();
      return data;
    },
    enabled: !!listing?.owner_id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container py-20 text-center text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!listing || !listing.is_paid) {
    return (
      <div className={isMobile ? "p-4 text-center" : "min-h-screen bg-background"}>
        {!isMobile && <Navbar />}
        <div className={isMobile ? "" : "container py-20 text-center"}>
          <Building2 className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <h2 className="mt-4 text-xl font-semibold">Profile not available</h2>
          <p className="mt-2 text-muted-foreground">This listing doesn't have a dedicated profile page.</p>
          <Link to={directoryLink}><Button className="mt-4">Back to Directory</Button></Link>
        </div>
      </div>
    );
  }

  const categoriesMap: Record<string, string> = {
    pet_shop: "Pet Shop", veterinary: "Veterinary", grooming: "Grooming",
    boarding: "Boarding", training: "Training", pet_food: "Pet Food", other: "Other",
  };

  const videoUrl = listing.video_url as string | null;
  const youtubeEmbed = videoUrl ? getYouTubeEmbedUrl(videoUrl) : null;
  const facebookEmbed = videoUrl && !youtubeEmbed ? getFacebookEmbedUrl(videoUrl) : null;
  const embedUrl = youtubeEmbed || facebookEmbed;

  return (
    <div className={isMobile ? "" : "min-h-screen bg-background"}>
      {!isMobile && <Navbar />}
      <div className={isMobile ? "p-4" : "container max-w-4xl py-8"}>
        <Link to={directoryLink} className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to Directory
        </Link>

        <div className="mb-8">
          <div className="flex items-start gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary/10 overflow-hidden">
              {listing.logo_url ? (
                <img src={listing.logo_url as string} alt={listing.name} className="h-full w-full object-cover" />
              ) : (
                <Building2 className="h-8 w-8 text-primary" />
              )}
            </div>
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground">{listing.name}</h1>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-primary">Verified Partner</Badge>
                {listing.is_featured && (
                  <Badge className="bg-accent text-accent-foreground"><Star className="mr-1 h-3 w-3" />Featured</Badge>
                )}
                <Badge variant="outline">{categoriesMap[listing.category] || listing.category}</Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Gallery */}
        {images.length > 0 && (
          <div className="mb-8 grid grid-cols-2 gap-3 md:grid-cols-3">
            {images.map((img: any) => (
              <div
                key={img.id}
                className="aspect-[4/3] overflow-hidden rounded-xl cursor-pointer"
                onClick={() => setLightboxUrl(img.image_url)}
              >
                <img src={img.image_url} alt="" className="h-full w-full object-cover hover:scale-105 transition-transform" loading="lazy" />
              </div>
            ))}
          </div>
        )}

        {/* Lightbox */}
        {lightboxUrl && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80" onClick={() => setLightboxUrl(null)}>
            <button
              className="absolute top-4 right-4 rounded-full bg-background/80 p-2 text-foreground hover:bg-background transition-colors"
              onClick={(e) => { e.stopPropagation(); setLightboxUrl(null); }}
            >
              <XIcon className="h-6 w-6" />
            </button>
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}

        {/* Video Embed */}
        {embedUrl && (
          <div className="mb-8">
            <h2 className="font-display text-lg font-semibold text-foreground mb-3 flex items-center gap-2"><Video className="h-5 w-5" /> Video</h2>
            <div className="aspect-video overflow-hidden rounded-xl border border-border">
              <iframe
                src={embedUrl}
                className="h-full w-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                title="Business video"
              />
            </div>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2">
            <Card>
              <CardContent className="p-6">
                <h2 className="font-display text-xl font-semibold text-foreground">About</h2>
                <p className="mt-3 whitespace-pre-wrap text-muted-foreground">{listing.description || "No description provided."}</p>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display font-semibold text-foreground">Contact Information</h3>
                <div className="mt-4 space-y-3">
                  {listing.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-muted-foreground">{listing.address}{listing.city ? `, ${listing.city}` : ""}{listing.country ? `, ${listing.country}` : ""}</span>
                    </div>
                  )}
                  {listing.phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 shrink-0 text-primary" />
                      <a href={`tel:${listing.phone}`} className="text-muted-foreground hover:text-primary">{listing.phone}</a>
                    </div>
                  )}
                  {listing.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 shrink-0 text-primary" />
                      <a href={`mailto:${listing.email}`} className="text-muted-foreground hover:text-primary">{listing.email}</a>
                    </div>
                  )}
                  {listing.website && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-4 w-4 shrink-0 text-primary" />
                      <a href={listing.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary">{listing.website}</a>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  {listing.whatsapp && (
                    <a href={`https://wa.me/${listing.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" size="sm">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {!listing.whatsapp && listing.phone && (
                    <a href={`https://wa.me/${listing.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer">
                      <Button className="w-full gap-2 bg-green-600 hover:bg-green-700" size="sm">
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </Button>
                    </a>
                  )}
                  {listing.email && (
                    <a href={`mailto:${listing.email}`}>
                      <Button variant="outline" className="w-full" size="sm">Send Email</Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>

            {ownerProfile && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="font-display font-semibold text-foreground">Owner</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {ownerProfile.show_name ? ownerProfile.full_name : "Business Owner"}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
      {!isMobile && <Footer />}
    </div>
  );
};

export default BusinessProfile;
