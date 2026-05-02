import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Search, AlertCircle, CheckCircle2, PawPrint } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

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
    const trimmed = code.trim().toUpperCase();
    const { data } = await supabase
      .from("certificate_verification" as any)
      .select("*")
      .or(`certificate_number.eq.${trimmed},verification_code.eq.${code.trim().toLowerCase()}`)
      .maybeSingle();
    setResult(data);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-12 max-w-2xl">
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mb-4">
            <ShieldCheck className="h-8 w-8 text-primary" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground mb-2">Certificate Verification</h1>
          <p className="text-muted-foreground">Enter a certificate number to verify its authenticity</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verify Certificate</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="e.g. CERT-001234"
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
                  <p className="text-sm text-muted-foreground">No paid certificate matches this number. Please check and try again.</p>
                </div>
              </div>
            )}

            {result && (
              <div className="rounded-lg border-2 border-green-500/30 bg-green-500/5 p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="h-6 w-6 text-green-600" />
                  <div>
                    <p className="font-bold text-green-700 dark:text-green-400">Verified Authentic</p>
                    <p className="text-sm text-muted-foreground">This certificate is registered with Pets Registry</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border">
                  <div>
                    <p className="text-xs text-muted-foreground">Certificate Number</p>
                    <p className="font-mono font-semibold text-foreground">{result.certificate_number}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Issued</p>
                    <p className="font-semibold text-foreground">{new Date(result.issued_at).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pet Name</p>
                    <p className="font-semibold text-foreground flex items-center gap-1"><PawPrint className="h-4 w-4" />{result.pet_name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Pet Code</p>
                    <p className="font-mono text-foreground">{result.pet_code || "—"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Species</p>
                    <p className="text-foreground capitalize">{result.species}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Breed</p>
                    <p className="text-foreground">{result.breed || "—"}</p>
                  </div>
                </div>
                <Badge className="bg-green-600 text-white">Officially Registered</Badge>
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
