import { Link } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ProtectedImage from "@/components/ProtectedImage";
import FoundPetTipDialog from "@/components/FoundPetTipDialog";
import { Gift, MapPin, Clock } from "lucide-react";
import {
  formatLostReportDate,
  getLostReportDescription,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
  isFoundSightingReport,
  toLostReportTipContext,
  type LostReportRow,
} from "@/lib/lostReportDisplay";

interface Props {
  report: LostReportRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LostReportDetailDialog = ({ report, open, onOpenChange }: Props) => {
  if (!report) return null;

  const name = getLostReportPetName(report);
  const isFound = isFoundSightingReport(report);
  const description = getLostReportDescription(report);
  const petId = report.pet_id || report.pets?.id || "";
  const tipContext = toLostReportTipContext(report);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 pr-6">
            {name}
            <Badge className={isFound ? "bg-primary" : "bg-destructive"}>
              {isFound ? "FOUND" : "LOST"}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="overflow-hidden rounded-xl border border-border">
            <ProtectedImage
              src={getLostReportImageUrl(report)}
              alt={name}
              className="aspect-[4/3] w-full object-cover"
            />
          </div>

          <p className="text-sm text-muted-foreground">{getLostReportSpeciesBreed(report)}</p>

          {description && (
            <p className="text-sm text-foreground/90 whitespace-pre-wrap">{description}</p>
          )}

          {report.last_seen_address && (
            <div className="flex items-start gap-2 text-sm">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{report.last_seen_address}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Last seen {formatLostReportDate(report)}
          </div>

          {report.reward && !isFound && (
            <div className="flex items-center gap-2 text-sm">
              <Gift className="h-4 w-4 text-accent" />
              <span className="font-semibold text-accent">Reward: {report.reward}</span>
            </div>
          )}

          <div className="flex flex-wrap gap-2 pt-1">
            {((report.last_seen_lat && report.last_seen_lng) || report.last_seen_address) && (
              <a
                href={
                  report.last_seen_lat && report.last_seen_lng
                    ? `https://www.google.com/maps?q=${report.last_seen_lat},${report.last_seen_lng}`
                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(report.last_seen_address!)}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-3 py-1.5 text-sm font-medium text-primary hover:bg-primary/10"
              >
                <MapPin className="h-3.5 w-3.5" /> Open in Google Maps
              </a>
            )}

            {!isFound && petId && (
              <FoundPetTipDialog
                petId={petId}
                petName={name}
                lostReport={tipContext}
              />
            )}

            {!report.is_guest && report.pets?.id && (
              <Button variant="outline" size="sm" asChild>
                <Link to={`/pet/${report.pets.id}`} onClick={() => onOpenChange(false)}>
                  View pet profile
                </Link>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LostReportDetailDialog;
