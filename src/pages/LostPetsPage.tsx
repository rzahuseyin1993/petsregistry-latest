import { useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import CmsRenderer from "@/components/CmsRenderer";
import Footer from "@/components/Footer";
import BrowseCountryBar from "@/components/BrowseCountryBar";
import { Card, CardContent } from "@/components/ui/card";
import ProtectedImage from "@/components/ProtectedImage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import FoundPetTipDialog from "@/components/FoundPetTipDialog";
import LostReportDetailDialog from "@/components/LostReportDetailDialog";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, MapPin, Clock, Gift, FileDown } from "lucide-react";
import { generateLostFlyer } from "@/lib/generateLostFlyer";
import { motion } from "framer-motion";
import { useBrowseCountryFilter } from "@/hooks/useBrowseCountryFilter";
import { fetchBrowseLostReports } from "@/lib/geoBrowseQueries";
import {
  formatLostReportDate,
  getLostReportDescription,
  getLostReportDetailLink,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
  isFoundSightingReport,
  toLostReportTipContext,
} from "@/lib/lostReportDisplay";

const LostPetsPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const reportId = searchParams.get("report");
  const [tab, setTab] = useState<"all" | "lost" | "found">("all");
  const {
    mode,
    effectiveCountry,
    activeLabel,
    isFiltering,
    selectedCountryValue,
    selectCountry,
    showAllCountries,
    sharePath,
    countryFilterKey,
  } = useBrowseCountryFilter();

  const { data: lostReports = [], isLoading } = useQuery({
    queryKey: ["all-lost-reports", countryFilterKey],
    queryFn: () => fetchBrowseLostReports(effectiveCountry),
  });

  const { lost, found } = useMemo(() => {
    const lostList: any[] = [];
    const foundList: any[] = [];
    for (const r of lostReports as any[]) {
      const isFound = isFoundSightingReport(r);
      (isFound ? foundList : lostList).push(r);
    }
    return { lost: lostList, found: foundList };
  }, [lostReports]);

  const displayedReports = useMemo(() => {
    if (tab === "lost") return lost;
    if (tab === "found") return found;
    return lostReports;
  }, [tab, lost, found, lostReports]);

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

  const highlightedReport = useMemo(
    () => (reportId ? (lostReports as any[]).find((r) => r.id === reportId) ?? null : null),
    [reportId, lostReports],
  );

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
            <h1 className="font-display text-3xl font-bold text-foreground">Lost & Found Pets</h1>
            <p className="mt-2 text-muted-foreground">
              {lostReports.length} report{lostReports.length === 1 ? "" : "s"}
              {isFiltering && activeLabel ? ` in ${activeLabel}` : mode === "all" ? " — all countries" : ""}.
              Help reunite pets with their families.
            </p>
          </div>

          <div className="mx-auto mt-8 max-w-3xl">
            <BrowseCountryBar
              mode={mode}
              selectedCountryValue={selectedCountryValue}
              activeLabel={activeLabel}
              isFiltering={isFiltering}
              sharePath={sharePath}
              onSelectCountry={selectCountry}
              onShowAllCountries={showAllCountries}
            />
          </div>

          <div className="mx-auto mt-4 flex max-w-3xl justify-center">
            <div className="inline-flex rounded-lg border border-border bg-muted/40 p-1">
              {([
                ["all", `All (${lostReports.length})`],
                ["lost", `Lost (${lost.length})`],
                ["found", `Found (${found.length})`],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setTab(value)}
                  className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                    tab === value
                      ? "bg-background text-foreground shadow"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : displayedReports.length === 0 ? (
            <div className="mt-16 text-center">
              <p className="text-lg text-muted-foreground">
                {tab === "found"
                  ? "No found-pet sightings yet."
                  : tab === "lost"
                    ? "🎉 No lost pets right now!"
                    : "No reports found."}
              </p>
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {displayedReports.map((report: any, i: number) => {
                const pet = report.pets;
                const name = getLostReportPetName(report);
                const detailLink = getLostReportDetailLink(report);
                const isFound = isFoundSightingReport(report);
                const description = getLostReportDescription(report);
                const petId = report.pet_id || pet?.id;
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
                        {description && (
                          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{description}</p>
                        )}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Last seen {formatLostReportDate(report)}
                          </span>
                          <div className="flex flex-wrap gap-2">
                            {!isFound && petId && (
                              <div onClick={(e) => e.preventDefault()}>
                                <FoundPetTipDialog
                                  petId={petId}
                                  petName={name}
                                  lostReport={toLostReportTipContext(report)}
                                  trigger={
                                    <Button size="sm" variant="default" className="h-7 gap-1 text-xs bg-success hover:bg-success/90 text-success-foreground">
                                      I Found This Pet
                                    </Button>
                                  }
                                />
                              </div>
                            )}
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
      <LostReportDetailDialog
        report={highlightedReport}
        open={!!highlightedReport}
        onOpenChange={(open) => {
          if (!open) {
            const next = new URLSearchParams(searchParams);
            next.delete("report");
            setSearchParams(next, { replace: true });
          }
        }}
      />
      <Footer />
    </div>
  );
};

export default LostPetsPage;
