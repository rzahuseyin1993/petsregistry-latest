import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Crown, FileText, Megaphone, Building2, ShieldCheck, Check, HandHeart } from "lucide-react";

const FeesPage = () => {
  const { data: settings = {} } = useQuery({
    queryKey: ["fees-page-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("key, value").like("key", "service_%");
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["fees-page-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price");
      return data || [];
    },
  });

  const fmt = (k: string, fb: string) => `$${settings[k] || fb}`;
  const billingFor = (svc: string) => (settings[`service_billing_${svc}`] || "").split(",").filter(Boolean);

  const services = [
    {
      key: "membership",
      icon: Crown,
      name: "Guardian / Verified Partner Membership",
      description: "Unlock premium platform features, including a free Lost Pet Flyer Builder and 1 free certificate credit.",
      cta: { label: "View Plans", to: "/membership" },
      tiers: [
        billingFor("membership").includes("monthly") && { label: "Monthly", price: fmt("service_price_membership_monthly", "5"), suffix: "/mo" },
        billingFor("membership").includes("yearly") && { label: "Yearly", price: fmt("service_price_membership_yearly", "50"), suffix: "/yr", badge: "Best value" },
        billingFor("membership").includes("one_time") && { label: "Lifetime", price: fmt("service_price_membership_one_time", "50"), suffix: "" },
      ].filter(Boolean) as any[],
      benefits: [
        "Lost Pet Flyer Builder — FREE for life",
        "1 FREE Pet Certificate credit",
        "Featured directory listing",
        "Verified badge",
      ],
    },
    {
      key: "certificate",
      icon: FileText,
      name: "Pet Certificates (Credit-based)",
      description: "Buy credits — 1 credit creates 1 official, verifiable pet certificate with QR code. Members receive 1 free credit.",
      cta: { label: "Buy Credits", to: "/dashboard/certificates" },
      tiers: [
        { label: "Per Credit", price: fmt("service_price_certificate_one_time", "15"), suffix: "/credit" },
      ],
      benefits: [
        "Official certificate number (CERT-XXXXXX)",
        "QR code for instant verification",
        "Downloadable PDF",
        "Lifetime verification at /verify",
      ],
    },
    {
      key: "flyer",
      icon: Megaphone,
      name: "Lost Pet Flyer Builder",
      description: "Create A4 lost-pet posters with AI-assisted layouts. FREE for paid members.",
      cta: { label: "Open Builder", to: "/dashboard/flyer-builder" },
      tiers: [
        billingFor("flyer").includes("one_time") && { label: "One-Time", price: fmt("service_price_flyer_one_time", "2"), suffix: "" },
        billingFor("flyer").includes("monthly") && { label: "Monthly", price: fmt("service_price_flyer_monthly", "1"), suffix: "/mo" },
        billingFor("flyer").includes("yearly") && { label: "Yearly", price: fmt("service_price_flyer_yearly", "10"), suffix: "/yr" },
      ].filter(Boolean) as any[],
      benefits: ["Pro A4 layouts", "Drag-and-drop editor", "Free for paid members"],
      memberFree: true,
    },
    {
      key: "directory",
      icon: Building2,
      name: "Business Directory Listing",
      description: "Get your pet business listed and discovered by pet owners worldwide.",
      cta: { label: "List Your Business", to: "/dashboard/directory" },
      tiers: [
        billingFor("directory").includes("monthly") && { label: "Monthly", price: fmt("service_price_directory_monthly", "10"), suffix: "/mo" },
        billingFor("directory").includes("yearly") && { label: "Yearly", price: fmt("service_price_directory_yearly", "100"), suffix: "/yr" },
        billingFor("directory").includes("one_time") && { label: "One-Time", price: fmt("service_price_directory_one_time", "10"), suffix: "" },
      ].filter(Boolean) as any[],
      benefits: ["Photo gallery", "Direct contact buttons", "Map placement"],
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main>
        <section className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
          <div className="container text-center max-w-3xl">
            <Badge className="mb-3" variant="secondary">Transparent Pricing</Badge>
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
              Service Fees & Pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              All our services in one place. Choose what fits — and remember: paid members get the Lost Pet Flyer Builder
              free for life and 1 free pet certificate credit.
            </p>
            <div className="mt-6 flex justify-center gap-3 flex-wrap">
              <Link to="/membership"><Button size="lg" className="gap-2"><Crown className="h-4 w-4" /> View Memberships</Button></Link>
              <Link to="/donate"><Button size="lg" variant="outline" className="gap-2"><HandHeart className="h-4 w-4" /> Support Us</Button></Link>
            </div>
          </div>
        </section>

        <section className="container py-12">
          <div className="grid gap-6 md:grid-cols-2">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <Card key={svc.key} className="relative overflow-hidden">
                  {svc.memberFree && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      FREE for paid members
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{svc.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-muted-foreground">{svc.description}</p>
                    {svc.tiers.length > 0 && (
                      <div className="grid gap-2">
                        {svc.tiers.map((t: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border p-3">
                            <span className="font-medium text-sm">{t.label}</span>
                            <div className="flex items-center gap-2">
                              {t.badge && <Badge variant="secondary" className="text-xs">{t.badge}</Badge>}
                              <span className="text-lg font-bold text-foreground">
                                {t.price}<span className="text-xs font-normal text-muted-foreground">{t.suffix}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <ul className="space-y-1.5">
                      {svc.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to={svc.cta.to} className="block">
                      <Button className="w-full">{svc.cta.label}</Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Plans cards summary */}
          {plans.length > 0 && (
            <div className="mt-12 rounded-xl border bg-card p-6">
              <div className="flex items-center gap-2 mb-4">
                <ShieldCheck className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl font-semibold">Why join as a paid member?</h2>
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                A single membership pays for itself. Here's what you unlock:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((p: any) => (
                  <div key={p.id} className="rounded-lg border p-4">
                    <h3 className="font-semibold">{p.name}</h3>
                    <p className="text-sm text-muted-foreground mt-1">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-lg border bg-muted/30 p-4 text-center text-sm text-muted-foreground">
            All prices in USD. Pay securely with credit card (Stripe) or PayPal. Have a question?{" "}
            <Link to="/contact" className="text-primary underline">Contact us</Link>.
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FeesPage;
