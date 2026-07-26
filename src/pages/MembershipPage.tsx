import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import CmsRenderer from "@/components/CmsRenderer";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Crown, Check, Shield, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { completeCheckout } from "@/lib/airwallexCheckout";
import {
  filterVisiblePaymentProviders,
  getCardProvider,
  getPaymentProviderLabel,
  parseFunctionError,
  type PaymentProvider,
} from "@/lib/paymentProviders";

type BillingInterval = "monthly" | "yearly" | "one_time";

const MembershipPage = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("yearly");

  // Handle return from the payment gateway (legacy return URLs point here).
  // Don't trust ?success alone — poll the server until the membership actually
  // shows up as active (webhooks can take a few seconds).
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (!success && !canceled) return;
    if (success === "true") {
      toast({ title: "Payment received!", description: "Confirming your membership..." });
      let attempts = 0;
      const timer = setInterval(async () => {
        attempts += 1;
        if (!user || attempts > 10) {
          clearInterval(timer);
          if (attempts > 10) {
            toast({
              title: "Still processing",
              description: "Your payment was received but activation is taking longer than usual. It will appear shortly.",
            });
          }
          return;
        }
        const { data } = await supabase
          .from("memberships")
          .select("id")
          .eq("user_id", user.id)
          .eq("status", "active")
          .gte("expires_at", new Date().toISOString())
          .limit(1);
        if (data && data.length > 0) {
          clearInterval(timer);
          queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
          toast({ title: "Membership activated! 🎉", description: "Welcome aboard." });
        }
      }, 3000);
      setSearchParams({}, { replace: true });
      return () => clearInterval(timer);
    }
    if (canceled === "true") {
      toast({ title: "Payment cancelled", description: "You were not charged.", variant: "destructive" });
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, user]);

  const { data: discountPercent } = useQuery({
    queryKey: ["yearly-discount"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "yearly_discount_percent").single();
      return Number(data?.value || 20);
    },
  });

  // Fetch allowed billing types for membership
  const { data: allowedBilling = ["monthly", "yearly"] } = useQuery({
    queryKey: ["membership-billing-modes"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "service_billing_membership").single();
      return (data?.value || "monthly,yearly").split(",").filter(Boolean) as BillingInterval[];
    },
  });

  // Fetch admin-configured prices from site_settings
  const { data: servicePrices } = useQuery({
    queryKey: ["membership-service-prices"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("key, value")
        .in("key", ["service_price_membership_monthly", "service_price_membership_yearly", "service_price_membership_one_time"]);
      const map: Record<string, string> = {};
      (data || []).forEach((s: any) => { map[s.key] = s.value; });
      return map;
    },
  });

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price");
      if (error) throw error;
      return data;
    },
  });

  const { data: myMemberships = [] } = useQuery({
    queryKey: ["my-memberships"],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("memberships")
        .select("*, membership_plans(name, slug)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .gte("expires_at", new Date().toISOString());
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch which payment gateways are active
  const { data: activeGateways = [] } = useQuery({
    queryKey: ["active-payment-gateways"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_settings_safe" as any)
        .select("provider, is_active") as any;
      return filterVisiblePaymentProviders(
        ((data || []) as any[]).filter((s) => s.is_active).map((s) => s.provider),
      );
    },
  });

  const [pendingCheckout, setPendingCheckout] = useState<string | null>(null);

  const subscribeMutation = useMutation({
    mutationFn: async ({ planId, provider }: { planId: string; provider: PaymentProvider }) => {
      if (!user) throw new Error("Please sign in first");

      const plan = plans.find((p: any) => p.id === planId);
      if (!plan) throw new Error("Plan not found");

      const { data, error } = await supabase.functions.invoke("membership-checkout", {
        body: { planId, billingInterval, provider },
      });

      if (error) throw new Error(await parseFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (data?.checkout || data?.url) {
        await completeCheckout(data);
      } else if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ["my-memberships"] });
        toast({ title: "Membership activated!", description: `You are now a ${plan.name}` });
      } else {
        throw new Error("The payment provider did not return a checkout link. Please try again or contact support.");
      }
    },
    onMutate: ({ planId, provider }) => setPendingCheckout(`${planId}-${provider}`),
    onSettled: () => setPendingCheckout(null),
    onError: (e: any) => toast({ title: "Checkout error", description: e.message, variant: "destructive" }),
  });

  const getPrice = (plan: any) => {
    // Use admin-configured service prices first, fall back to plan table values
    const adminMonthly = servicePrices?.["service_price_membership_monthly"];
    const adminYearly = servicePrices?.["service_price_membership_yearly"];
    const adminOneTime = servicePrices?.["service_price_membership_one_time"];

    if (billingInterval === "monthly") {
      if (adminMonthly) return parseFloat(adminMonthly);
      return plan.monthly_price && plan.monthly_price > 0
        ? plan.monthly_price
        : Math.ceil((plan.price / 12) * 100) / 100;
    }
    if (billingInterval === "one_time") {
      if (adminOneTime) return parseFloat(adminOneTime);
      return plan.price;
    }
    // yearly
    if (adminYearly) return parseFloat(adminYearly);
    return plan.price;
  };

  const getIntervalLabel = () => {
    if (billingInterval === "monthly") return "/mo";
    if (billingInterval === "yearly") return "/yr";
    return "";
  };

  const getButtonLabel = (plan: any) => {
    const price = getPrice(plan).toFixed(2);
    if (billingInterval === "one_time") return `Pay $${price} One-Time`;
    return `Subscribe for $${price}${getIntervalLabel()}`;
  };

  const isSubscribed = (planSlug: string) => {
    return myMemberships.some((m: any) => (m as any).membership_plans?.slug === planSlug);
  };

  // Set default billing to first allowed type
  const effectiveBilling = allowedBilling.includes(billingInterval) ? billingInterval : allowedBilling[0] || "yearly";
  useEffect(() => {
    if (effectiveBilling !== billingInterval) {
      setBillingInterval(effectiveBilling as BillingInterval);
    }
  }, [effectiveBilling, billingInterval]);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CmsRenderer slug="membership" fallback={
      <>
      <div className="bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
        <div className="container text-center">
          <Crown className="mx-auto h-12 w-12 text-accent" />
          <h1 className="mt-4 font-display text-4xl font-bold text-foreground">Membership Plans</h1>
          <p className="mt-3 text-lg text-muted-foreground">Unlock premium features with a membership</p>

          {/* Billing interval selector - only show if more than 1 option */}
          {allowedBilling.length > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 flex-wrap">
              {allowedBilling.map((bt) => (
                <button
                  key={bt}
                  onClick={() => setBillingInterval(bt as BillingInterval)}
                  className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    billingInterval === bt
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {bt === "monthly" ? "Monthly" : bt === "yearly" ? "Yearly" : "One-Time"}
                  {bt === "yearly" && allowedBilling.includes("monthly") && (
                    <Badge variant="secondary" className="ml-2 text-xs">Save {discountPercent || 20}%</Badge>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="container max-w-4xl py-12">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {plans.map((plan: any) => {
              const subscribed = isSubscribed(plan.slug);
              const features = Array.isArray(plan.features) ? plan.features : [];
              const cardProvider = getCardProvider(activeGateways);
              return (
                <Card key={plan.id} className={`relative flex h-full flex-col overflow-hidden ${plan.plan_type === "partner" ? "border-accent ring-1 ring-accent/30" : ""}`}>
                  {plan.plan_type === "partner" && (
                    <div className="absolute right-0 top-0 rounded-bl-xl bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                      <Star className="mr-1 inline h-3 w-3" />Best for Business
                    </div>
                  )}
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      {plan.plan_type === "guardian" ? <Shield className="h-8 w-8 text-primary" /> : <Crown className="h-8 w-8 text-accent" />}
                      <div>
                        <CardTitle className="text-xl">{plan.name}</CardTitle>
                        <p className="text-sm text-muted-foreground">{plan.description}</p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col">
                    <p className="text-3xl font-bold text-foreground">
                      ${getPrice(plan).toFixed(2)}
                      {billingInterval !== "one_time" && (
                        <span className="text-base font-normal text-muted-foreground">{getIntervalLabel()}</span>
                      )}
                    </p>
                    {billingInterval === "one_time" && (
                      <p className="text-sm text-muted-foreground mt-1">One-time payment • Lifetime access</p>
                    )}
                    <ul className="mt-4 space-y-2">
                      {features.map((f: string, i: number) => (
                        <li key={i} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-auto pt-6">
                      {subscribed ? (
                        <Badge className="w-full justify-center bg-green-100 py-2 text-green-800">Active Membership</Badge>
                      ) : !user ? (
                        <Link to="/login"><Button className="w-full">Sign In to Subscribe</Button></Link>
                      ) : activeGateways.length === 0 ? (
                        <Button className="w-full" disabled>Payment not configured</Button>
                      ) : (
                        <div className="space-y-2">
                          {cardProvider && (
                            <Button
                              className="w-full"
                              onClick={() => subscribeMutation.mutate({ planId: plan.id, provider: cardProvider })}
                              disabled={!!pendingCheckout}
                            >
                              {pendingCheckout === `${plan.id}-${cardProvider}`
                                ? "Processing..."
                                : `Pay with ${getPaymentProviderLabel(cardProvider)} — ${getButtonLabel(plan)}`}
                            </Button>
                          )}
                          {activeGateways.includes("paypal") && (
                            <Button
                              variant="outline"
                              className="w-full border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba] hover:text-white"
                              onClick={() => subscribeMutation.mutate({ planId: plan.id, provider: "paypal" })}
                              disabled={!!pendingCheckout}
                            >
                              {pendingCheckout === `${plan.id}-paypal` ? "Processing..." : `Pay with PayPal — $${getPrice(plan).toFixed(2)}${getIntervalLabel()}`}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      </>
      } />
      <Footer />
    </div>
  );
};

export default MembershipPage;
