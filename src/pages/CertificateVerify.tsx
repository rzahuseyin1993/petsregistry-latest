import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, AlertCircle, CheckCircle2, PawPrint, FileText, Baby } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CERTIFICATE_TYPE_LABELS, type CertificateType } from "@/lib/certificateTypes";

const CertificateVerify = () => {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [searched, setSearched] = useState(false);

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
    setLoading(false);
  };

  const certType: CertificateType = result?.certificate_type === "birth" ? "birth" : "ownership";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Official Certificate Verification</h1>
          <p className="text-muted-foreground">
            Pets Registry — worldwide pet registration. Enter certificate number (e.g. PR-2026-100005-OWN or -BIRTH).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verify certificate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. PR-2026-100005-OWN"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verify()}
                className="font-mono"
              />
              <Button onClick={verify} disabled={loading || !code.trim()} className="gap-2">
                <Search className="h-4 w-4" /> Verify
              </Button>
            </div>

            {searched && !loading && !result && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 flex gap-3">
                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Certificate not found</p>
                  <p className="text-sm text-muted-foreground">No issued certificate matches this number.</p>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-400">Verified authentic</p>
                    <p className="text-sm text-muted-foreground">Registered with Pets Registry — official government-style pet documents</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-green-600 text-white gap-1">
                    {certType === "birth" ? <Baby className="h-3 w-3" /> : <FileText className="h-3 w-3" />}
                    {CERTIFICATE_TYPE_LABELS[certType]}
                  </Badge>
                  <Badge variant="outline">Officially registered</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Certificate number</p>
                    <p className="font-mono font-semibold text-foreground">{result.certificate_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Issued</p>
                    <p className="font-semibold text-foreground">{new Date(result.issued_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pet name</p>
                    <p className="font-semibold flex items-center gap-1"><PawPrint className="h-4 w-4" />{result.pet_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pet ID</p>
                    <p className="font-mono text-foreground">{result.pet_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Species</p>
                    <p className="capitalize">{result.species}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Breed</p>
                    <p>{result.breed || "—"}</p>
                  </div>
                  {certType === "birth" && (
                    <>
                      <div>
                        <p className="text-xs text-muted-foreground">Date of birth</p>
                        <p>{result.date_of_birth ? new Date(result.date_of_birth).toLocaleDateString() : "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sex</p>
                        <p>{result.sex || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Sire (father)</p>
                        <p>{result.sire_name || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Dam (mother)</p>
                        <p>{result.dam_name || "—"}</p>
                      </div>
                      {result.birth_location && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">Place of birth</p>
                          <p>{result.birth_location}</p>
                        </div>
                      )}
                    </>
                  )}
                  {result.issued_for_name && (
                    <div className="col-span-2">
                      <p className="text-xs text-muted-foreground">Issued for</p>
                      <p>{result.issued_for_name}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
      <Footer />
    </div>
  );
};

export default CertificateVerify;
