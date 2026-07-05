import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  ShieldCheck,
  Search,
  AlertCircle,
  CheckCircle2,
  PawPrint,
  FileText,
  Baby,
  Database,
  Lock,
  Calendar,
  Hash,
  User,
  MapPin,
  Scale,
  Ruler,
  Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CERTIFICATE_TYPE_LABELS, type CertificateType } from "@/lib/certificateTypes";

function VerifyDetail({
  icon: Icon,
  label,
  value,
  mono = false,
  className = "",
}: {
  icon?: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  mono?: boolean;
  className?: string;
}) {
  return (
    <div className={`rounded-lg border bg-background/80 px-3 py-2.5 ${className}`}>
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-0.5 flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </p>
      <p className={`text-sm font-semibold text-foreground ${mono ? "font-mono" : ""}`}>{value || "—"}</p>
    </div>
  );
}

const CertificateVerify = () => {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [verifiedAt, setVerifiedAt] = useState<Date | null>(null);

  const verify = async () => {
    if (!code.trim()) return;
    setLoading(true);
    setSearched(true);
    const trimmed = code.trim();
    const upper = trimmed.toUpperCase();
    const { data } = await supabase
      .from("certificate_verification" as any)
      .select("*")
      .or(`certificate_number.eq.${upper},verification_code.eq.${trimmed.toLowerCase()},pet_code.eq.${upper}`)
      .maybeSingle();
    setResult(data);
    setVerifiedAt(data ? new Date() : null);
    setLoading(false);
  };

  const certType: CertificateType = result?.certificate_type === "birth" ? "birth" : "ownership";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4 ring-4 ring-primary/5">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Official Certificate Verification</h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Pets Registry — worldwide pet registration. Enter your certificate number to confirm the document is
            registered in our official database and not a counterfeit or AI-generated copy.
          </p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Verify certificate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                placeholder="e.g. PR-2026-100005-OWN or PR-2026-100005-BIRTH"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                className="font-mono flex-1"
              />
              <Button onClick={verify} disabled={loading || !code.trim()} className="gap-2 shrink-0">
                <Search className="h-4 w-4" /> {loading ? "Checking…" : "Verify now"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              You can also search by pet registry ID (pet code) or the verification code printed on your certificate.
            </p>
          </CardContent>
        </Card>

        {searched && !loading && !result && (
          <Card className="border-destructive/30">
            <CardContent className="pt-6">
              <div className="flex gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive/10">
                  <AlertCircle className="h-6 w-6 text-destructive" />
                </div>
                <div className="space-y-2">
                  <p className="font-bold text-lg text-destructive">Certificate not found</p>
                  <p className="text-sm text-muted-foreground">
                    No issued certificate in the Pets Registry database matches this number. This may indicate a
                    forged document, an unpaid draft, or a typo — double-check the number and try again.
                  </p>
                  <div className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Tips</p>
                    <p>· Certificate numbers look like PR-2026-100005-OWN or PR-2026-100005-BIRTH</p>
                    <p>· Only paid, officially issued certificates appear in verification results</p>
                    <p>· Contact support if you believe your certificate should be listed</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {result && (
          <div className="space-y-4">
            {/* Authentic banner */}
            <div className="relative overflow-hidden rounded-2xl border-2 border-green-600/40 bg-gradient-to-br from-green-500/10 via-green-500/5 to-emerald-500/10 p-6 shadow-lg">
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-green-500/10 blur-2xl" />
              <div className="relative flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-green-600 text-white shadow-lg shadow-green-600/30">
                  <CheckCircle2 className="h-9 w-9" />
                </div>
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <p className="font-display text-2xl font-bold text-green-700 dark:text-green-400">
                      Verified Authentic
                    </p>
                    <Badge className="bg-green-600 text-white gap-1">
                      <Lock className="h-3 w-3" />
                      Database match
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    This certificate is registered with Pets Registry and matches our official records. The document
                    you hold corresponds to a legitimate, paid issuance — not a sample or reproduction.
                  </p>
                  {verifiedAt && (
                    <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                      <Database className="h-3 w-3" />
                      Verified at {verifiedAt.toLocaleString()} against live registry data
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Certificate record card */}
            <Card className="overflow-hidden border-amber-600/20 shadow-md">
              <div className="h-1.5 bg-gradient-to-r from-amber-500 via-amber-400 to-amber-600" />
              <CardHeader className="pb-3 bg-muted/30">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    {certType === "birth" ? (
                      <Baby className="h-5 w-5 text-orange-500" />
                    ) : (
                      <FileText className="h-5 w-5 text-amber-600" />
                    )}
                    {CERTIFICATE_TYPE_LABELS[certType]} — Official Record
                  </CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-green-600 text-white">Issued &amp; paid</Badge>
                    <Badge variant="outline" className="border-amber-600/40 text-amber-700 dark:text-amber-400">
                      Officially registered
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-5 space-y-6">
                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <Hash className="h-3.5 w-3.5" />
                    Certificate details
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <VerifyDetail
                      icon={Hash}
                      label="Certificate number"
                      value={result.certificate_number}
                      mono
                      className="sm:col-span-2 border-primary/20 bg-primary/5"
                    />
                    <VerifyDetail
                      icon={Calendar}
                      label="Date issued"
                      value={new Date(result.issued_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    />
                    {result.issued_for_name && (
                      <VerifyDetail icon={User} label="Issued for (owner / buyer)" value={result.issued_for_name} />
                    )}
                  </div>
                </section>

                <section>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                    <PawPrint className="h-3.5 w-3.5" />
                    Registered pet
                  </h3>
                  <div className="grid sm:grid-cols-2 gap-2">
                    <VerifyDetail icon={PawPrint} label="Pet name" value={result.pet_name} />
                    <VerifyDetail icon={Hash} label="Pet registry ID" value={result.pet_code} mono />
                    <VerifyDetail label="Species" value={<span className="capitalize">{result.species}</span>} />
                    <VerifyDetail label="Breed" value={result.breed} />
                    {result.fur_color && <VerifyDetail label="Color / markings" value={result.fur_color} />}
                  </div>
                </section>

                {certType === "birth" && (
                  <section>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1.5">
                      <Baby className="h-3.5 w-3.5" />
                      Birth &amp; parentage
                    </h3>
                    <div className="grid sm:grid-cols-2 gap-2">
                      <VerifyDetail
                        icon={Calendar}
                        label="Date of birth"
                        value={
                          result.date_of_birth
                            ? new Date(result.date_of_birth).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "long",
                                day: "numeric",
                              })
                            : "—"
                        }
                      />
                      <VerifyDetail label="Sex" value={result.sex} />
                      {result.birth_location && (
                        <VerifyDetail icon={MapPin} label="Place of birth" value={result.birth_location} className="sm:col-span-2" />
                      )}
                      {result.birth_weight && <VerifyDetail icon={Scale} label="Birth weight" value={result.birth_weight} />}
                      {result.birth_height && <VerifyDetail icon={Ruler} label="Birth height" value={result.birth_height} />}
                      {result.eye_color && <VerifyDetail icon={Eye} label="Eye color" value={result.eye_color} />}
                      {result.breeder_name && (
                        <VerifyDetail icon={User} label="Breeder" value={result.breeder_name} className="sm:col-span-2" />
                      )}
                      {result.sire_name && result.sire_name !== "—" && (
                        <VerifyDetail label="Sire (father)" value={result.sire_name} />
                      )}
                      {result.dam_name && result.dam_name !== "—" && (
                        <VerifyDetail label="Dam (mother)" value={result.dam_name} />
                      )}
                    </div>
                  </section>
                )}

                <div className="rounded-lg border border-green-600/20 bg-green-500/5 p-4 flex gap-3">
                  <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="text-sm space-y-1">
                    <p className="font-semibold text-green-700 dark:text-green-400">Anti-counterfeit protection</p>
                    <p className="text-muted-foreground">
                      Pets Registry certificates are recorded at issuance. Copies, screenshots, or AI-generated
                      lookalikes will fail verification unless they match a real certificate number in our database.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <p className="text-center text-xs text-muted-foreground">
              Need a certificate?{" "}
              <Link to="/dashboard/certificates" className="text-primary hover:underline font-medium">
                Issue one from your dashboard
              </Link>
            </p>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};

export default CertificateVerify;
