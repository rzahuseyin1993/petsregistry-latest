import Navbar from "@/components/Navbar";
import CmsRenderer from "@/components/CmsRenderer";
import Footer from "@/components/Footer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import MembershipBadge from "@/components/MembershipBadge";
import { Heart, DollarSign, PawPrint, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import ContactOwnerDialog from "@/components/ContactOwnerDialog";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { fetchBrowseAdoptions } from "@/lib/geoBrowseQueries";

const AdoptionPage = () => {
  const { user, membership } = useAuth();
  const { visitorCountry, countryFilter } = useVisitorGeo();

  const { data: listings = [], refetch } = useQuery({
    queryKey: ["adoption-listings", countryFilter],
    queryFn: async () => {
      const data = await fetchBrowseAdoptions(visitorCountry);
      if (!data.length) return [];
      // Fetch owner memberships for all listings
      const ownerIds = [...new Set((data || []).map((l: any) => l.owner_id))];
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("user_id, membership_plans(name, plan_type, badge_icon_url)")
        .in("user_id", ownerIds)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString());
      const membershipMap = new Map<string, { planType: string; planName: string; badgeIconUrl: string | null }>();
      (membershipData || []).forEach((m: any) => {
        if (m.membership_plans && !membershipMap.has(m.user_id)) {
          membershipMap.set(m.user_id, { planType: m.membership_plans.plan_type, planName: m.membership_plans.name, badgeIconUrl: m.membership_plans.badge_icon_url || null });
        }
      });
      return data.map((l: any) => ({ ...l, _ownerMembership: membershipMap.get(l.owner_id) || null }));
    },
  });

  const handleAdoptRequest = async (adoptionId: string) => {
    if (!user) {
      toast.error("Please register and become a member to adopt");
      return;
    }
    if (!membership) {
      toast.error("An active membership is required to adopt and receive the pet transfer");
      return;
    }
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ adopter_id: user.id, status: "pending" })
      .eq("id", adoptionId)
      .eq("status", "available");
    if (error) { toast.error("Failed to send adoption request"); return; }

    // Notify the owner via the trusted edge function (in-app + email server-side)
    await supabase.functions.invoke("owner-messaging", {
      body: { action: "adoption_request", adoptionId },
    }).catch(() => {});

    toast.success("Adoption request sent! The owner will review it.");
    refetch();
  };

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <CmsRenderer slug="adoption" fallback={
      <main className="flex-1">
        <section className="border-b border-border bg-muted/30 py-12">
          <div className="container text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-100">
              <Heart className="h-8 w-8 text-rose-600" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Adopt a Pet</h1>
            <p className="mx-auto mt-2 max-w-lg text-muted-foreground">
              Give a loving pet a new forever home. Browse pets available for adoption below.
            </p>
          </div>
        </section>

        {/* Adoption Process Guide */}
        <section className="container py-8">
          <Card className="border-rose-200 bg-rose-50/50">
            <CardContent className="p-6">
              <h2 className="font-display text-lg font-bold text-foreground mb-4 flex items-center gap-2">
                <PawPrint className="h-5 w-5 text-rose-500" /> How Adoption Works
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-sm">1</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Contact & Meet</p>
                    <p className="text-xs text-muted-foreground">Message the owner (no membership needed) to arrange a meet-up.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-sm">2</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Become a Member</p>
                    <p className="text-xs text-muted-foreground">Join as a paid member when you are ready for the official pet transfer.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-sm">3</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Pay the Owner</p>
                    <p className="text-xs text-muted-foreground">If there's an adoption fee, pay the owner directly on the spot when you meet.</p>
                  </div>
                </div>
                <div className="flex gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-sm">4</div>
                  <div>
                    <p className="font-semibold text-sm text-foreground">Confirm Transfer</p>
                    <p className="text-xs text-muted-foreground">Both parties confirm in their dashboard. Pet data transfers to the new owner automatically.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <section className="container pb-10">
          {listings.length === 0 ? (
            <div className="py-20 text-center">
              <PawPrint className="mx-auto h-16 w-16 text-muted-foreground/20" />
              <p className="mt-4 text-lg text-muted-foreground">No pets available for adoption right now.</p>
              <p className="text-sm text-muted-foreground">Check back soon or list your pet for adoption from the dashboard.</p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {listings.map((listing: any) => {
                const pet = listing.pets;
                const image = pet?.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                return (
                  <Card key={listing.id} className="group overflow-hidden border-border transition-all hover:shadow-md hover:-translate-y-0.5">
                    <div className="relative aspect-[4/3] overflow-hidden">
                      <img
                        src={image?.image_url || "/placeholder.svg"}
                        alt={pet?.name}
                        className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      />
                      <Badge className="absolute left-3 top-3 bg-rose-500 text-white">
                        <Heart className="mr-1 h-3 w-3" /> For Adoption
                      </Badge>
                      {listing._ownerMembership && (
                        <div className="absolute right-3 top-3">
                          <MembershipBadge planType={listing._ownerMembership.planType} planName={listing._ownerMembership.planName} badgeIconUrl={listing._ownerMembership.badgeIconUrl} size="sm" />
                        </div>
                      )}
                    </div>
                    <CardContent className="p-4">
                      <h3 className="font-display text-lg font-bold text-foreground">{pet?.name}</h3>
                      <p className="text-sm text-muted-foreground">{pet?.species} • {pet?.breed || "Mixed"}</p>
                      {pet?.age && <p className="text-sm text-muted-foreground">Age: {pet.age}</p>}
                      {listing.description && (
                        <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{listing.description}</p>
                      )}
                      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        {listing.adoption_fee > 0 ? (
                          <span className="flex items-center gap-1 text-sm font-semibold text-foreground">
                            <DollarSign className="h-4 w-4" /> {listing.adoption_fee}
                          </span>
                        ) : (
                          <span className="text-sm font-medium text-emerald-600">Free</span>
                        )}
                        {user?.id === listing.owner_id ? (
                          <Badge variant="secondary">Your listing</Badge>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            <ContactOwnerDialog ownerId={listing.owner_id} petName={pet?.name || "Pet"} adoptionId={listing.id} />
                            {membership ? (
                              <Button size="sm" className="gap-2" onClick={() => handleAdoptRequest(listing.id)}>
                                <Heart className="h-4 w-4" /> Adopt
                              </Button>
                            ) : (
                              <Link to={user ? "/membership" : "/register"}>
                                <Button size="sm" variant="default" className="gap-2">
                                  <Crown className="h-4 w-4" /> Sign up to be a member
                                </Button>
                              </Link>
                            )}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
      </main>
      } />
      <Footer />
    </div>
  );
};

export default AdoptionPage;
