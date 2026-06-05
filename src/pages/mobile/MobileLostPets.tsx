import { Link } from "react-router-dom";
import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, MapPin, HeartHandshake, PlusCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { fetchBrowseLostReports } from "@/lib/geoBrowseQueries";
import {
  formatLostReportDate,
  getLostReportDetailLink,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
} from "@/lib/lostReportDisplay";

const FOUND_TAG = "[FOUND PET SIGHTING]";

const MobileLostPets = () => {
  const [tab, setTab] = useState<"lost" | "found">("lost");
  const { visitorCountry, countryFilter } = useVisitorGeo();

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["mobile-lost-reports-all", countryFilter],
    queryFn: () => fetchBrowseLostReports(visitorCountry),
  });

  const { lost, found } = useMemo(() => {
    const lost: any[] = [];
    const found: any[] = [];
    for (const r of reports as any[]) {
      const isFound = typeof r.description === "string" && r.description.startsWith(FOUND_TAG);
      (isFound ? found : lost).push(r);
    }
    return { lost, found };
  }, [reports]);

  const list = tab === "found" ? found : lost;
  const isFoundView = tab === "found";

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          {isFoundView ? (
            <HeartHandshake className="h-5 w-5 text-primary" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          )}
          {isFoundView ? "Found Pets" : "Lost Pets"}
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          {list.length} active {isFoundView ? "sighting" : "report"}{list.length === 1 ? "" : "s"}
        </p>
      </div>

      {/* Lost / Found tabs */}
      <div className="inline-flex w-full rounded-lg border border-border bg-muted/40 p-1">
        <button
          type="button"
          onClick={() => setTab("lost")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            !isFoundView
              ? "bg-destructive text-destructive-foreground shadow"
              : "text-muted-foreground"
          }`}
        >
          Lost ({lost.length})
        </button>
        <button
          type="button"
          onClick={() => setTab("found")}
          className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition ${
            isFoundView
              ? "bg-primary text-primary-foreground shadow"
              : "text-muted-foreground"
          }`}
        >
          Found ({found.length})
        </button>
      </div>

      {/* Report CTA — public-accessible */}
      <Link to="/m/report-lost" className="block">
        <Button size="sm" className="w-full gap-1.5 h-9 text-xs">
          <PlusCircle className="h-3.5 w-3.5" />
          {isFoundView ? "Report a Found Pet" : "Report Your Lost Pet"}
        </Button>
      </Link>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 text-sm">
          {isFoundView
            ? "No found-pet sightings yet. If you spotted one, tap above to report it."
            : "No lost pet reports right now. Great news!"}
        </p>
      ) : (
        <div className="space-y-2.5">
          {list.map((r: any) => {
            const name = getLostReportPetName(r);
            const detailLink = getLostReportDetailLink(r).replace("/lost-pets", "/m/lost-pets").replace("/pet/", "/m/pet/");
            const cleanDesc = isFoundView && r.description
              ? r.description.replace(FOUND_TAG, "").trim()
              : r.description;
            return (
              <Link key={r.id} to={detailLink}>
                <Card className="overflow-hidden border-border/60 shadow-sm">
                  <div className="flex">
                    <div className="h-20 w-20 shrink-0 bg-muted">
                      <img
                        src={getLostReportImageUrl(r)}
                        alt={name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="flex-1 p-2.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <p className="font-semibold text-xs text-foreground truncate">
                          {name}
                        </p>
                        <Badge
                          variant={isFoundView ? "default" : "destructive"}
                          className={`text-[9px] h-4 px-1.5 ${isFoundView ? "bg-primary" : ""}`}
                        >
                          {isFoundView ? "FOUND" : "LOST"}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground">{getLostReportSpeciesBreed(r)}</p>
                      {!isFoundView && (
                        <p className="text-[10px] text-muted-foreground">Last seen {formatLostReportDate(r)}</p>
                      )}
                      {r.last_seen_address && (
                        <>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5 leading-tight">
                            <MapPin className="h-2.5 w-2.5 shrink-0" />{" "}
                            <span className="truncate">{r.last_seen_address}</span>
                          </p>
                          <a
                            href={
                              r.last_seen_lat && r.last_seen_lng
                                ? `https://www.google.com/maps?q=${r.last_seen_lat},${r.last_seen_lng}`
                                : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.last_seen_address)}`
                            }
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); e.preventDefault(); window.open((e.currentTarget as HTMLAnchorElement).href, '_blank'); }}
                            className="inline-flex items-center gap-0.5 rounded border border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[9px] font-medium text-primary"
                          >
                            <MapPin className="h-2.5 w-2.5" /> Open in Maps
                          </a>
                        </>
                      )}
                      {cleanDesc && (
                        <p className="text-[10px] text-muted-foreground line-clamp-2 leading-snug">
                          {cleanDesc}
                        </p>
                      )}
                      {!isFoundView && r.reward && (
                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700">
                          Reward: {r.reward}
                        </Badge>
                      )}
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

export default MobileLostPets;
