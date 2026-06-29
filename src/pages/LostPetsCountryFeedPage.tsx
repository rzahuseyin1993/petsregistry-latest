import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import ProtectedImage from "@/components/ProtectedImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, MapPin, Clock, Gift, FileDown, Share2 } from "lucide-react";
import { generateLostFlyer } from "@/lib/generateLostFlyer";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { countryStringToVisitor, getVisitorCountryFilter } from "@/lib/geoCountry";
import { fetchBrowseLostReports } from "@/lib/geoBrowseQueries";
import { buildLostPetsCountryFeedUrl } from "@/lib/lostPetsRoutes";
import {
  formatLostReportDate,
  getLostReportDetailLink,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
  isFoundSightingReport,
} from "@/lib/lostReportDisplay";

const LostPetsCountryFeedPage = () => {
  const { country: countryParam } = useParams<{ country: string }>();
  const countryName = decodeURIComponent(countryParam || "").trim();
  const effectiveCountry = useMemo(
    () => (countryName ? countryStringToVisitor(countryName) : null),
    [countryName],
  );
  const countryFilterKey = getVisitorCountryFilter(effectiveCountry) ?? countryName;

  const { data: lostReports = [], isLoading } = useQuery({
    queryKey: ["lost-pets-country-feed", countryFilterKey],
    queryFn: () => fetchBrowseLostReports(effectiveCountry),
    enabled: !!countryName,
  });

  const ownerIds = Array.from(
    new Set(
      (lostReports as any[])
        .map((r) => r?.pets?.owner_id)
        .filter((id): id is string => !!id),
    ),
  );

  const { data: flyerEnabledOwners = new Set<string>() } = useQuery({
    queryKey: ["flyer-enabled-owners", ownerIds.sort().join(",")],
    enabled: ownerIds.length > 0,
    queryFn: async () => {
      const enabled = new Set<string>();
      const nowIso = new Date().toISOString();
      const [memRes, subRes] = await Promise.all([
        supabase.from("memberships").select("user_id").in("user_id", ownerIds).eq("status", "active").gt("expires_at", nowIso),
        supabase.from("flyer_subscriptions" as any).select("user_id").in("user_id", ownerIds).eq("status", "active"),
      ]);
      (memRes.data || []).forEach((r: any) => r?.user_id && enabled.add(r.user_id));
      (subRes.data || []).forEach((r: any) => r?.user_id && enabled.add(r.user_id));
      return enabled;
    },
  });

  const handleDownloadFlyer = async (report: any) => {
    const pet = report.pets;
    await generateLostFlyer({
      petName: getLostReportPetName(report),
      species: report.guest_pet_species || pet?.species || "Unknown",
      breed: report.guest_pet_breed || pet?.breed || "",
      color: pet?.color || undefined,
      description: report.description || undefined,
      lastSeenAddress: report.last_seen_address || undefined,
      reward: report.reward || undefined,
      contactPhone: undefined,
      petId: pet?.id || report.id,
      imageUrl: getLostReportImageUrl(report),
    });
  };

  const handleShare = async () => {
    const url = buildLostPetsCountryFeedUrl(countryName);
    const title = `Lost & Found in ${countryName}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch {
      // cancelled or unavailable
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (!countryName) {
    return (
      <div className="flex min-h-screen flex-col bg-background">
        <Navbar />
        <main className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground">
          Country not specified. <Link to="/lost-pets" className="ml-1 text-primary underline">Browse all lost pets</Link>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Local feed</p>

          <div className="mt-2 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
                Lost &amp; Found in {countryName}
              </h1>
              <p className="mt-2 text-muted-foreground">
                {lostReports.length} active report{lostReports.length === 1 ? "" : "s"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <Link to="/report-lost">
                  <AlertTriangle className="h-4 w-4" />
                  Report a Lost Pet
                </Link>
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : lostReports.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg text-muted-foreground">No reports found in {countryName}.</p>
              <Button asChild variant="link" className="mt-2">
                <Link to="/lost-pets">View all countries</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {lostReports.map((report: any, i: number) => {
                const pet = report.pets;
                const name = getLostReportPetName(report);
                const detailLink = getLostReportDetailLink(report);
                const isFound = isFoundSightingReport(report);
                return (
                  <motion.div
                    key={report.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="overflow-hidden border-destructive/20 transition-shadow hover:shadow-lg">
                      <Link to={detailLink}>
                        <div className="relative aspect-[4/3] overflow-hidden">
                          <ProtectedImage src={getLostReportImageUrl(report)} alt={name} />
                          <Badge
                            className={`absolute left-3 top-3 ${
                              isFound
                                ? "bg-primary text-primary-foreground"
                                : "bg-destructive text-destructive-foreground animate-pulse"
                            }`}
                          >
                            {isFound ? "FOUND" : "LOST"}
                          </Badge>
                          {report.reward && (
                            <Badge className="absolute right-3 top-3 gap-1 bg-success text-success-foreground">
                              <Gift className="h-3 w-3" /> Reward: {report.reward}
                            </Badge>
                          )}
                        </div>
                      </Link>
                      <CardContent className="p-4">
                        <Link to={detailLink}>
                          <h3 className="font-display text-lg font-bold text-foreground">{name}</h3>
                        </Link>
                        <p className="text-sm text-muted-foreground">{getLostReportSpeciesBreed(report)}</p>
                        {report.last_seen_address && (
                          <p className="mt-2 flex items-center gap-1 text-sm text-destructive">
                            <MapPin className="h-3.5 w-3.5" /> {report.last_seen_address}
                          </p>
                        )}
                        <div className="mt-3 flex items-center justify-between">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last seen {formatLostReportDate(report)}
                          </span>
                          {pet?.owner_id && flyerEnabledOwners.has(pet.owner_id) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 text-xs"
                              onClick={(e) => {
                                e.preventDefault();
                                handleDownloadFlyer(report);
                              }}
                            >
                              <FileDown className="h-3 w-3" /> Download Flyer
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default LostPetsCountryFeedPage;
