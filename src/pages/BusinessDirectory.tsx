import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import MembershipBadge from "@/components/MembershipBadge";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, MapPin, Phone, Globe, Mail, Star, Building2, Check, X, Crown, ArrowRight, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";

const categories = [
  { value: "all", label: "All Categories" },
  { value: "pet_shop", label: "Pet Shop" },
  { value: "veterinary", label: "Veterinary" },
  { value: "grooming", label: "Grooming" },
  { value: "boarding", label: "Boarding" },
  { value: "training", label: "Training" },
  { value: "pet_food", label: "Pet Food" },
  { value: "other", label: "Other" },
];

const BusinessDirectory = () => {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [page, setPage] = useState(1);

  // Fetch admin-configured directory pricing
  const { data: directoryPricing } = useQuery({
    queryKey: ["directory-pricing-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", [
          "service_billing_directory",
          "service_price_directory_monthly",
          "service_price_directory_yearly",
          "service_price_directory_one_time",
        ]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const dirBillingMode = directoryPricing?.service_billing_directory || "one_time";
  const dirPriceMonthly = directoryPricing?.service_price_directory_monthly || "10";
  const dirPriceYearly = directoryPricing?.service_price_directory_yearly || "100";
  const dirPriceOneTime = directoryPricing?.service_price_directory_one_time || "10";

  const dirPriceLabel = useMemo(() => {
    const types = dirBillingMode.split(",").filter(Boolean);
    if (types.includes("monthly") && types.includes("yearly")) return `$${dirPriceMonthly}/mo or $${dirPriceYearly}/yr`;
    if (types.includes("monthly")) return `$${dirPriceMonthly}/mo`;
    if (types.includes("yearly")) return `$${dirPriceYearly}/yr`;
    return `$${dirPriceOneTime}`;
  }, [dirBillingMode, dirPriceMonthly, dirPriceYearly, dirPriceOneTime]);

  const { data: perPageSetting } = useQuery({
    queryKey: ["directory-per-page-setting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "directory_per_page")
        .maybeSingle();
      return data?.value ? parseInt(data.value, 10) : 8;
    },
  });

  const perPage = perPageSetting || 8;

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["business-listings", search, category],
    queryFn: async () => {
      let query = supabase
        .from("business_listings")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("is_featured", { ascending: false })
        .order("is_paid", { ascending: false })
        .order("created_at", { ascending: false });

      if (category !== "all") query = query.eq("category", category);
      if (search) query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%,city.ilike.%${search}%`);

      const { data, error } = await query;
      if (error) throw error;

      // Fetch membership badges
      const ownerIds = [...new Set((data || []).map((l: any) => l.owner_id))];
      if (ownerIds.length === 0) return data || [];
      const { data: memData } = await supabase
        .from("memberships")
        .select("user_id, membership_plans(name, plan_type, badge_icon_url)")
        .in("user_id", ownerIds)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString());
      const memMap = new Map<string, { planType: string; planName: string; badgeIconUrl: string | null }>();
      (memData || []).forEach((m: any) => {
        if (m.membership_plans && !memMap.has(m.user_id)) {
          memMap.set(m.user_id, { planType: m.membership_plans.plan_type, planName: m.membership_plans.name, badgeIconUrl: m.membership_plans.badge_icon_url || null });
        }
      });

      // Fetch first image for each paid listing
      const paidIds = (data || []).filter((l: any) => l.is_paid).map((l: any) => l.id);
      let imgMap = new Map<string, string>();
      if (paidIds.length > 0) {
        const { data: imgData } = await supabase
          .from("business_listing_images")
          .select("listing_id, image_url")
          .in("listing_id", paidIds)
          .order("sort_order")
          .limit(100);
        (imgData || []).forEach((img: any) => {
          if (!imgMap.has(img.listing_id)) imgMap.set(img.listing_id, img.image_url);
        });
      }

      return (data || []).map((l: any) => ({
        ...l,
        _ownerMembership: memMap.get(l.owner_id) || null,
        _firstImage: imgMap.get(l.id) || null,
      }));
    },
  });

  const paidListings = listings.filter((l: any) => l.is_paid);
  const freeListings = listings.filter((l: any) => !l.is_paid);
  const sorted = [...paidListings, ...freeListings];

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleCategory = (v: string) => { setCategory(v); setPage(1); };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CmsRenderer slug="directory" fallback={
      <>
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
        <div className="container text-center">
          <h1 className="font-display text-4xl font-bold text-foreground">Pet Business Directory</h1>
          <p className="mt-3 text-lg text-muted-foreground">Find local pet shops, vets, groomers and more</p>
          <div className="mx-auto mt-8 flex max-w-2xl gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search businesses..." value={search} onChange={(e) => handleSearch(e.target.value)} className="pl-10" />
            </div>
            <Select value={category} onValueChange={handleCategory}>
              <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div className="container py-12">
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: perPage }).map((_, i) => (
              <Card key={i} className="animate-pulse"><CardContent className="h-28 p-4" /></Card>
            ))}
          </div>
        ) : listings.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="mx-auto h-16 w-16 text-muted-foreground/30" />
            <h3 className="mt-4 text-lg font-semibold text-foreground">No businesses found</h3>
            <p className="mt-1 text-muted-foreground">Try adjusting your search or category filter</p>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {paginated.map((listing: any) => (
                <Card key={listing.id} className={`group transition-all hover:shadow-md overflow-hidden ${listing.is_featured ? "border-accent ring-1 ring-accent/30" : ""}`}>
                  {/* Thumbnail for paid listings */}
                  {listing.is_paid && (listing._firstImage || listing.logo_url) && (
                    <Link to={`/directory/${listing.id}`}>
                      <div className="aspect-[4/3] overflow-hidden bg-muted">
                        <img
                          src={listing._firstImage || listing.logo_url}
                          alt={listing.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                      </div>
                    </Link>
                  )}
                  <CardContent className="flex gap-3 p-3">
                    {/* Logo / Icon */}
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/10 overflow-hidden">
                      {listing.logo_url ? (
                        <img src={listing.logo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <Building2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {listing.is_paid ? (
                          <Link to={`/directory/${listing.id}`} className="truncate font-semibold text-sm text-foreground hover:text-primary transition-colors">
                            {listing.name}
                          </Link>
                        ) : (
                          <h3 className="truncate font-semibold text-sm text-foreground">{listing.name}</h3>
                        )}
                        {listing.is_featured && <Star className="h-3.5 w-3.5 shrink-0 text-accent fill-accent" />}
                      </div>
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {listing._ownerMembership && (
                          <MembershipBadge planType={listing._ownerMembership.planType} planName={listing._ownerMembership.planName} badgeIconUrl={listing._ownerMembership.badgeIconUrl} size="sm" />
                        )}
                        {listing.is_paid && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 text-primary">Verified</Badge>
                        )}
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">{categories.find(c => c.value === listing.category)?.label || listing.category}</Badge>
                      </div>
                      {listing.city && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground truncate">
                          <MapPin className="h-3 w-3 shrink-0" />
                          {listing.city}{listing.country ? `, ${listing.country}` : ""}
                        </p>
                      )}
                      {listing.description && (
                        <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">{listing.description}</p>
                      )}
                      {listing.is_paid && (
                        <div className="mt-1 flex items-center gap-1.5">
                          {listing.whatsapp && (
                            <a href={`https://wa.me/${listing.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                              <Button variant="outline" size="sm" className="h-6 px-2 text-[10px] gap-1 text-green-600 border-green-200 hover:bg-green-50">
                                <MessageCircle className="h-3 w-3" /> WhatsApp
                              </Button>
                            </a>
                          )}
                          <Link to={`/directory/${listing.id}`}>
                            <Button variant="link" size="sm" className="h-auto p-0 text-[11px] text-primary gap-1">
                              View Profile <ArrowRight className="h-3 w-3" />
                            </Button>
                          </Link>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)} className="gap-1">
                  <ChevronLeft className="h-4 w-4" /> Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <Button key={p} variant={p === currentPage ? "default" : "ghost"} size="sm" className="h-8 w-8 p-0" onClick={() => setPage(p)}>{p}</Button>
                  ))}
                </div>
                <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)} className="gap-1">
                  Next <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}

            <p className="mt-3 text-center text-xs text-muted-foreground">
              Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, sorted.length)} of {sorted.length} listings
              {paidListings.length > 0 && ` • ${paidListings.length} verified partner${paidListings.length > 1 ? "s" : ""} shown first`}
            </p>
          </>
        )}
      </div>

      {/* Free vs Paid comparison */}
      <div className="border-t bg-muted/30 py-16">
        <div className="container max-w-4xl">
          <div className="text-center">
            <Crown className="mx-auto h-10 w-10 text-accent" />
            <h2 className="mt-3 font-display text-3xl font-bold text-foreground">List Your Business</h2>
            <p className="mt-2 text-muted-foreground">Get your pet business in front of thousands of pet owners</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-display text-xl font-bold text-foreground">Free Listing</h3>
                <p className="mt-1 text-2xl font-bold text-foreground">$0<span className="text-sm font-normal text-muted-foreground">/forever</span></p>
                <p className="mt-2 text-sm text-muted-foreground">Basic listing — shown after all paid members</p>
                <ul className="mt-5 space-y-3">
                  <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Business name & description</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Category listing</li>
                  <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Address & contact info</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />Business logo & photo gallery</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />Video showcase</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />Dedicated profile page</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />"Verified Partner" badge</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />Logo pin on Pet Map with name label</li>
                  <li className="flex items-center gap-2 text-sm text-muted-foreground"><X className="h-4 w-4 text-muted-foreground/50" />"Nearby Businesses" sidebar feature</li>
                </ul>
                <Link to="/login"><Button variant="outline" className="mt-6 w-full">Get Started Free</Button></Link>
              </CardContent>
            </Card>
            <Card className="border-accent ring-1 ring-accent/30">
              <CardContent className="relative p-6">
                <div className="absolute right-4 top-4 rounded-full bg-accent px-3 py-0.5 text-xs font-semibold text-accent-foreground">
                  <Star className="mr-1 inline h-3 w-3" />Recommended
                </div>
                <h3 className="font-display text-xl font-bold text-foreground">Verified Partner</h3>
                <p className="mt-1 text-2xl font-bold text-foreground">{dirPriceLabel}</p>
                <p className="mt-2 text-sm text-muted-foreground">Premium placement — always shown before free listings</p>
                <ul className="mt-5 space-y-3">
                  <li className="flex items-center gap-2 text-sm"><Check className="h-4 w-4 text-primary" />Everything in Free</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Custom business logo</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Up to 3 photo gallery images</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Video showcase (YouTube/Facebook)</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />WhatsApp & Email contact buttons</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />"Verified Partner" badge</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Priority listing on page 1</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />🗺️ Logo pin on Pet Map with business name label</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Featured in "Nearby Businesses" sidebar</li>
                  <li className="flex items-center gap-2 text-sm font-medium"><Check className="h-4 w-4 text-primary" />Direct WhatsApp button on map popup</li>
                </ul>
                <Link to="/membership"><Button className="mt-6 w-full gap-2">Become a Partner <ArrowRight className="h-4 w-4" /></Button></Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      </>
      } />
      <Footer />
    </div>
  );
};

export default BusinessDirectory;
