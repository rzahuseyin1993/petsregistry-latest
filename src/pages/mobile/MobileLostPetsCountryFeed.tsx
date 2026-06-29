import { Link, useParams } from "react-router-dom";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Share2, PlusCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
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

const MobileLostPetsCountryFeed = () => {
  const { country: countryParam } = useParams<{ country: string }>();
  const countryName = decodeURIComponent(countryParam || "").trim();
  const effectiveCountry = useMemo(
    () => (countryName ? countryStringToVisitor(countryName) : null),
    [countryName],
  );
  const countryFilterKey = getVisitorCountryFilter(effectiveCountry) ?? countryName;

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["mobile-lost-pets-country-feed", countryFilterKey],
    queryFn: () => fetchBrowseLostReports(effectiveCountry),
    enabled: !!countryName,
  });

  const handleShare = async () => {
    const url = buildLostPetsCountryFeedUrl(countryName, { mobile: true });
    try {
      if (navigator.share) {
        await navigator.share({ title: `Lost & Found in ${countryName}`, url });
        return;
      }
    } catch {
      // cancelled
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied");
    } catch {
      toast.error("Could not copy link");
    }
  };

  if (!countryName) {
    return (
      <div className="p-4 text-center text-sm text-muted-foreground">
        <Link to="/m/lost-pets" className="text-primary underline">Back to lost pets</Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Local feed</p>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-lg font-bold text-foreground">Lost &amp; Found in {countryName}</h1>
          <p className="mt-1 text-xs text-muted-foreground">
            {reports.length} active report{reports.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-8 shrink-0 gap-1 px-2" onClick={handleShare}>
          <Share2 className="h-3.5 w-3.5" />
          Share
        </Button>
      </div>

      <Link to="/m/report-lost" className="block">
        <Button size="sm" className="h-9 w-full gap-1.5 text-xs">
          <PlusCircle className="h-3.5 w-3.5" />
          Report a Lost Pet
        </Button>
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : reports.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">No reports in {countryName}.</p>
      ) : (
        <div className="space-y-2.5">
          {reports.map((r: any) => {
            const name = getLostReportPetName(r);
            const isFound = isFoundSightingReport(r);
            const detailLink = getLostReportDetailLink(r).replace("/lost-pets", "/m/lost-pets").replace("/pet/", "/m/pet/");
            return (
              <Link key={r.id} to={detailLink}>
                <Card className="overflow-hidden border-border/60 shadow-sm">
                  <div className="flex">
                    <div className="h-20 w-20 shrink-0 bg-muted">
                      <img src={getLostReportImageUrl(r)} alt={name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <CardContent className="flex flex-1 flex-col justify-center p-3">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display text-sm font-bold text-foreground">{name}</h3>
                        <Badge
                          className={`text-[10px] ${isFound ? "bg-primary" : "bg-destructive"}`}
                        >
                          {isFound ? "FOUND" : "LOST"}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{getLostReportSpeciesBreed(r)}</p>
                      {r.last_seen_address && (
                        <p className="mt-1 flex items-center gap-1 text-[11px] text-destructive">
                          <MapPin className="h-3 w-3" /> {r.last_seen_address}
                        </p>
                      )}
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        Last seen {formatLostReportDate(r)}
                      </p>
                    </CardContent>
                  </div>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileLostPetsCountryFeed;
