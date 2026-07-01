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
      name: "Pet Certificates",
      description: "Official ownership ($15) and birth ($15) certificates — verifiable worldwide. Members receive 1 free ownership credit.",
      cta: { label: "Buy Credits", to: "/dashboard/certificates" },
      tiers: [
        { label: "Ownership", price: fmt("service_price_certificate_ownership", "15"), suffix: "/cert" },
        { label: "Birth", price: fmt("service_price_certificate_birth", "15"), suffix: "/cert" },
        { label: "Both (bundle)", price: fmt("service_price_certificate_bundle", "30"), suffix: "/pet" },
      ],
      benefits: [
        "Ownership certificate — proof of registered owner",
        "Birth certificate — date of birth & parentage",
        "Downloadable PDF + print for buyers",
        "Lifetime verification at /verify",
        "Breeder litter registration",
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
    <div className="min-h-screen bg-muted/40">
      <Navbar />
      <main>
        <section className="border-b border-primary/15 bg-gradient-to-br from-primary/15 via-background to-accent/15 py-16">
          <div className="container max-w-3xl text-center">
            <Badge className="mb-3 border-primary/30 bg-primary/10 text-primary">Transparent Pricing</Badge>
            <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">
              Service Fees & Pricing
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              All our services in one place. Choose what fits — and remember: paid members get the Lost Pet Flyer Builder
              free for life and 1 free pet certificate credit.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <Link to="/membership"><Button size="lg" className="gap-2 shadow-sm"><Crown className="h-4 w-4" /> View Memberships</Button></Link>
              <Link to="/donate"><Button size="lg" variant="outline" className="gap-2 border-primary/30 bg-card hover:bg-primary/10"><HandHeart className="h-4 w-4" /> Support Us</Button></Link>
            </div>
          </div>
        </section>

        <section className="container py-12">
          <div className="grid gap-6 md:grid-cols-2">
            {services.map((svc) => {
              const Icon = svc.icon;
              return (
                <Card key={svc.key} className="relative overflow-hidden border-primary/20 bg-card shadow-md transition-shadow hover:shadow-lg">
                  {svc.memberFree && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                      FREE for paid members
                    </div>
                  )}
                  <CardHeader className="border-b border-primary/10 bg-primary/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                        <Icon className="h-6 w-6" />
                      </div>
                      <div>
                        <CardTitle className="text-xl">{svc.name}</CardTitle>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4 bg-gradient-to-b from-card to-muted/20 p-6">
                    <p className="text-sm text-foreground/80">{svc.description}</p>
                    {svc.tiers.length > 0 && (
                      <div className="grid gap-2">
                        {svc.tiers.map((t: any, i: number) => (
                          <div key={i} className="flex items-center justify-between rounded-lg border border-primary/20 bg-primary/5 px-3 py-3">
                            <span className="text-sm font-medium text-foreground">{t.label}</span>
                            <div className="flex items-center gap-2">
                              {t.badge && <Badge className="bg-primary/15 text-xs text-primary hover:bg-primary/15">{t.badge}</Badge>}
                              <span className="text-lg font-bold text-primary">
                                {t.price}<span className="text-xs font-normal text-muted-foreground">{t.suffix}</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <ul className="space-y-1.5 rounded-lg border border-border/80 bg-background/60 p-3">
                      {svc.benefits.map((b, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-foreground/85">
                          <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                          <span>{b}</span>
                        </li>
                      ))}
                    </ul>
                    <Link to={svc.cta.to} className="block">
                      <Button className="w-full shadow-sm">{svc.cta.label}</Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Plans cards summary */}
          {plans.length > 0 && (
            <div className="mt-12 rounded-2xl border border-primary/20 bg-card p-6 shadow-md">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                </div>
                <h2 className="font-display text-xl font-semibold">Why join as a paid member?</h2>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">
                A single membership pays for itself. Here's what you unlock:
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {plans.map((p: any) => (
                  <div key={p.id} className="rounded-xl border border-primary/15 bg-primary/5 p-4">
                    <h3 className="font-semibold text-foreground">{p.name}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{p.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mt-8 rounded-xl border border-primary/15 bg-primary/5 p-4 text-center text-sm text-muted-foreground">
            All prices in USD. Pay securely with credit card (Stripe) or PayPal. Have a question?{" "}
            <Link to="/contact" className="font-medium text-primary underline">Contact us</Link>.
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
};

export default FeesPage;
