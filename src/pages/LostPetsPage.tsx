import Navbar from "@/components/Navbar";
import CmsRenderer from "@/components/CmsRenderer";
import Footer from "@/components/Footer";
import { Card, CardContent } from "@/components/ui/card";
import ProtectedImage from "@/components/ProtectedImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPin, Clock, Gift, FileDown } from "lucide-react";
import { generateLostFlyer } from "@/lib/generateLostFlyer";
import { motion } from "framer-motion";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { fetchBrowseLostReports } from "@/lib/geoBrowseQueries";
import {
  formatLostReportDate,
  getLostReportDetailLink,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
} from "@/lib/lostReportDisplay";

const LostPetsPage = () => {
  const { visitorCountry, countryFilter, countryLabel } = useVisitorGeo();
  const { data: lostReports = [], isLoading } = useQuery({
    queryKey: ["all-lost-reports", countryFilter],
    queryFn: () => fetchBrowseLostReports(visitorCountry),
  });

  // Build a set of user IDs who have flyer-builder access (active membership OR flyer subscription).
  // Only these owners' reports will show the "Download Flyer" button publicly.
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
        supabase
          .from("memberships")
          .select("user_id")
          .in("user_id", ownerIds)
          .eq("status", "active")
          .gt("expires_at", nowIso),
        supabase
          .from("flyer_subscriptions" as any)
          .select("user_id")
          .in("user_id", ownerIds)
          .eq("status", "active"),
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

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <CmsRenderer slug="lost-pets" fallback={
      <main className="flex-1 py-10">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-7 w-7 text-destructive" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground">Lost Pets</h1>
            <p className="mt-2 text-muted-foreground">
              Help reunite these pets with their families
              {countryLabel ? ` in ${countryLabel}` : ""}. If you spot any of them, please contact the owner.
            </p>
          </div>

          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : lostReports.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg text-muted-foreground">🎉 No lost pets right now!</p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {lostReports.map((report: any, i: number) => {
                const pet = report.pets;
                const name = getLostReportPetName(report);
                const detailLink = getLostReportDetailLink(report);
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
                          <ProtectedImage
                            src={getLostReportImageUrl(report)}
                            alt={name}
                          />
                          <Badge className="absolute left-3 top-3 bg-destructive text-destructive-foreground animate-pulse">
                            LOST
                          </Badge>
                          {report.reward && (
                            <Badge className="absolute right-3 top-3 bg-success text-success-foreground gap-1">
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
                          <div className="mt-2 space-y-1.5">
                            <p className="flex items-center gap-1 text-sm text-destructive">
                              <MapPin className="h-3.5 w-3.5" /> {report.last_seen_address}
                            </p>
                            <a
                              href={
                                report.last_seen_lat && report.last_seen_lng
                                  ? `https://www.google.com/maps?q=${report.last_seen_lat},${report.last_seen_lng}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.last_seen_address)}`
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10"
                            >
                              <MapPin className="h-3 w-3" /> Open in Google Maps
                            </a>
                          </div>
                        )}
                        {report.description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{report.description}</p>
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
                              onClick={(e) => { e.preventDefault(); handleDownloadFlyer(report); }}
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
      } />
      <Footer />
    </div>
  );
};

export default LostPetsPage;
