import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, PawPrint, DollarSign, MessageCircle, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import ContactOwnerDialog from "@/components/ContactOwnerDialog";
import MembershipBadge from "@/components/MembershipBadge";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { fetchBrowseAdoptions } from "@/lib/geoBrowseQueries";

const MobileAdopt = () => {
  const { user, membership } = useAuth();
  const { visitorCountry, countryFilter } = useVisitorGeo();

  const { data: adoptions = [], isLoading, refetch } = useQuery({
    queryKey: ["mobile-adoptions", countryFilter],
    queryFn: async () => {
      const data = await fetchBrowseAdoptions(visitorCountry);
      const ownerIds = [...new Set(data.map((l: any) => l.owner_id))];
      if (ownerIds.length === 0) return [];
      const { data: membershipData } = await supabase
        .from("memberships")
        .select("user_id, membership_plans(name, plan_type, badge_icon_url)")
        .in("user_id", ownerIds)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString());
      const membershipMap = new Map<string, any>();
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
    const listing = adoptions.find((l: any) => l.id === adoptionId);
    const { error } = await supabase
      .from("pet_adoptions")
      .update({ adopter_id: user.id, status: "pending" })
      .eq("id", adoptionId);
    if (error) { toast.error("Failed to send adoption request"); return; }

    if (listing) {
      const petName = listing.pets?.name || "your pet";
      await supabase.rpc("insert_system_notification", {
        _user_id: listing.owner_id,
        _title: "New Adoption Request",
        _message: `Someone has requested to adopt ${petName}. Go to your Adoption Manager to review and confirm.`,
        _type: "adoption",
        _link: "/dashboard/adoption",
      });

      try {
        const { data: ownerProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("user_id", listing.owner_id)
          .single();
        if (ownerProfile?.email) {
          await supabase.functions.invoke("send-smtp-email", {
            body: {
              to: ownerProfile.email,
              subject: `New Adoption Request for ${petName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px">
                  <h2 style="color:#e11d48">🐾 New Adoption Request</h2>
                  <p>Hi ${ownerProfile.full_name || "Pet Owner"},</p>
                  <p>Someone has requested to adopt <strong>${petName}</strong>.</p>
                  <p>Please log in to your <strong>Adoption Manager</strong> dashboard to review and respond.</p>
                  <p style="margin-top:24px;color:#6b7280;font-size:13px">— Pet Registry Team</p>
                </div>
              `,
            },
          });
        }
      } catch (emailErr) {
        console.warn("Email notification failed (non-blocking):", emailErr);
      }
    }

    toast.success("Adoption request sent! The owner will review it.");
    refetch();
  };

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Heart className="h-5 w-5 text-rose-500" /> Adopt a Pet
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{adoptions.length} pets available</p>
      </div>

      {/* How Adoption Works Guide */}
      <Card className="border-rose-200 bg-rose-50/50">
        <CardContent className="p-3">
          <h2 className="font-display text-sm font-bold text-foreground mb-2 flex items-center gap-1.5">
            <PawPrint className="h-4 w-4 text-rose-500" /> How Adoption Works
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { step: "1", title: "Contact & Meet", desc: "Message the owner (no membership needed)." },
              { step: "2", title: "Become a Member", desc: "Join when ready for the official transfer." },
              { step: "3", title: "Pay the Owner", desc: "Pay any adoption fee in person when you meet." },
              { step: "4", title: "Confirm Transfer", desc: "Both confirm in dashboard. Pet transfers automatically." },
            ].map((s) => (
              <div key={s.step} className="flex gap-2">
                <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600 font-bold text-[10px]">{s.step}</div>
                <div>
                  <p className="font-semibold text-[11px] text-foreground">{s.title}</p>
                  <p className="text-[9px] text-muted-foreground leading-tight">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : adoptions.length === 0 ? (
        <p className="text-center text-muted-foreground py-12">No pets available for adoption right now.</p>
      ) : (
        <div className="space-y-3">
          {adoptions.map((a: any) => {
            const pet = a.pets;
            const img = pet?.pet_images?.sort((x: any, y: any) => x.sort_order - y.sort_order)[0];
            return (
              <Card key={a.id} className="overflow-hidden border-border/60 shadow-sm">
                <div className="flex">
                  <Link to={`/m/pet/${pet?.id}`} className="w-28 shrink-0">
                    <div className="aspect-square bg-muted relative">
                      <img
                        src={img?.image_url || "/placeholder.svg"}
                        alt={pet?.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {a._ownerMembership && (
                        <div className="absolute right-1 top-1">
                          <MembershipBadge planType={a._ownerMembership.planType} planName={a._ownerMembership.planName} badgeIconUrl={a._ownerMembership.badgeIconUrl} size="sm" />
                        </div>
                      )}
                    </div>
                  </Link>
                  <CardContent className="flex-1 p-2.5 flex flex-col justify-between">
                    <div>
                      <Link to={`/m/pet/${pet?.id}`}>
                        <p className="truncate text-sm font-semibold text-foreground">{pet?.name}</p>
                      </Link>
                      <p className="truncate text-[11px] text-muted-foreground">{pet?.species} • {pet?.breed || "Mixed"}</p>
                      {pet?.age && <p className="text-[10px] text-muted-foreground">Age: {pet.age}</p>}
                      {a.description && (
                        <p className="line-clamp-1 text-[10px] text-muted-foreground mt-0.5">{a.description}</p>
                      )}
                      <div className="mt-1">
                        {a.adoption_fee > 0 ? (
                          <span className="flex items-center gap-0.5 text-xs font-semibold text-foreground">
                            <DollarSign className="h-3 w-3" /> {a.adoption_fee}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-emerald-600">Free</span>
                        )}
                      </div>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {user?.id === a.owner_id ? (
                        <Badge variant="secondary" className="text-[9px] h-5">Your listing</Badge>
                      ) : (
                        <>
                          <ContactOwnerDialog ownerId={a.owner_id} petName={pet?.name || "Pet"} adoptionId={a.id}>
                            <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 px-2">
                              <MessageCircle className="h-3 w-3" /> Contact
                            </Button>
                          </ContactOwnerDialog>
                          {membership ? (
                            <Button size="sm" className="h-7 text-[10px] gap-1 px-2" onClick={() => handleAdoptRequest(a.id)}>
                              <Heart className="h-3 w-3" /> Adopt
                            </Button>
                          ) : (
                            <Link to={user ? "/m/membership" : "/m/register"}>
                              <Button size="sm" className="h-7 text-[10px] gap-1 px-2">
                                <Crown className="h-3 w-3" /> Member
                              </Button>
                            </Link>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileAdopt;
