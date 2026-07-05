import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Award, Baby, FileText, ShieldCheck, ZoomIn } from "lucide-react";
import { getSampleCertificatePetData } from "@/lib/certificateSampleData";
import { getDefaultTemplateForType, renderCertificateView } from "@/lib/certificateRender";
import { CERTIFICATE_TYPE_LABELS, type CertificateType } from "@/lib/certificateTypes";

function SampleWatermark({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div
        aria-hidden
        className="absolute inset-0 z-20 pointer-events-none flex items-center justify-center overflow-hidden"
      >
        <span
          className={`font-black uppercase select-none text-destructive/30 -rotate-[22deg] ${
            compact ? "text-[clamp(1.25rem,12cqw,2.5rem)] tracking-[0.2em]" : "text-[clamp(2rem,14cqw,4.5rem)] tracking-[0.35em]"
          }`}
        >
          SAMPLE
        </span>
      </div>
      <div className="absolute top-2 left-1/2 -translate-x-1/2 z-20 pointer-events-none">
        <Badge variant="destructive" className="text-[10px] sm:text-xs shadow-sm">
          SAMPLE — NOT VALID FOR OFFICIAL USE
        </Badge>
      </div>
    </>
  );
}

function SampleCertificateFrame({
  type,
  onClick,
  compact = true,
}: {
  type: CertificateType;
  onClick: () => void;
  compact?: boolean;
}) {
  const template = getDefaultTemplateForType(type);
  const petData = getSampleCertificatePetData(type);
  const Icon = type === "birth" ? Baby : FileText;

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left rounded-xl border-2 border-border bg-muted/20 p-3 transition-all hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${type === "birth" ? "text-orange-500" : "text-amber-600"}`} />
        <span className="text-sm font-semibold">{CERTIFICATE_TYPE_LABELS[type]}</span>
        <Badge variant="outline" className="ml-auto text-[10px]">$15</Badge>
      </div>
      <div
        className="relative border rounded-lg overflow-hidden bg-white shadow-inner"
        style={{ aspectRatio: "297/210", containerType: "inline-size" }}
      >
        <div className="absolute inset-0" style={{ pointerEvents: "none" }}>
          {renderCertificateView(template, petData, null, {}, false)}
        </div>
        <SampleWatermark compact={compact} />
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/0 group-hover:bg-black/10 transition-colors">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity rounded-full bg-background/90 px-3 py-1.5 text-xs font-medium shadow flex items-center gap-1.5">
            <ZoomIn className="h-3.5 w-3.5" /> Click to enlarge
          </span>
        </div>
      </div>
    </button>
  );
}

const CertificateSampleShowcase = () => {
  const [zoomType, setZoomType] = useState<CertificateType | null>(null);

  return (
    <>
      <Card className="mb-6 border-primary/20 bg-gradient-to-br from-primary/[0.03] to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Award className="h-5 w-5 text-primary" />
            Official certificate samples — $15 each
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Preview what your ownership and birth certificates look like. Click any sample for a full A4 landscape view.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <SampleCertificateFrame type="ownership" onClick={() => setZoomType("ownership")} />
            <SampleCertificateFrame type="birth" onClick={() => setZoomType("birth")} />
          </div>

          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <ShieldCheck className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="space-y-2 text-sm">
              <p className="font-medium text-foreground">
                Every issued certificate can be verified online — protection against fake or AI-generated copies.
              </p>
              <p className="text-muted-foreground">
                Only certificates registered in the Pets Registry database will return a verified result. Enter the
                certificate number from your document on our verification page.
              </p>
              <Button variant="outline" size="sm" asChild className="gap-2">
                <Link to="/verify">
                  <ShieldCheck className="h-4 w-4" />
                  Verify a certificate
                </Link>
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!zoomType} onOpenChange={(open) => !open && setZoomType(null)}>
        <DialogContent className="max-w-[min(calc(100vw-2rem),920px)] p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {zoomType === "birth" ? <Baby className="h-5 w-5 text-orange-500" /> : <FileText className="h-5 w-5 text-amber-600" />}
              Sample {zoomType ? CERTIFICATE_TYPE_LABELS[zoomType] : ""}
            </DialogTitle>
          </DialogHeader>
          {zoomType && (
            <div
              className="relative w-full border-2 border-border rounded-lg overflow-hidden bg-white shadow-lg"
              style={{ aspectRatio: "297/210", containerType: "inline-size" }}
            >
              <div className="absolute inset-0">
                {renderCertificateView(
                  getDefaultTemplateForType(zoomType),
                  getSampleCertificatePetData(zoomType),
                  null,
                  {},
                  false,
                )}
              </div>
              <SampleWatermark />
            </div>
          )}
          <p className="text-xs text-center text-muted-foreground">
            A4 landscape preview · Watermarked sample only · Real certificates include your pet&apos;s unique registry ID
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateSampleShowcase;
