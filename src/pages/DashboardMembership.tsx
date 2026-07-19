import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DashboardSidebar from "@/components/DashboardSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { Crown, Check, Shield, Star, ArrowRight, CalendarDays, Loader2 } from "lucide-react";
import { completeCheckout } from "@/lib/airwallexCheckout";
import {
  filterVisiblePaymentProviders,
  getCardProvider,
  getPaymentProviderLabel,
  parseFunctionError,
  type PaymentProvider,
} from "@/lib/paymentProviders";

type BillingInterval = "monthly" | "yearly" | "one_time";

const DashboardMembership = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("yearly");

  const { data: myMemberships = [], isLoading: loadingMemberships, isError: membershipsError } = useQuery({
    queryKey: ["my-all-memberships"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("memberships")
        .select("*, membership_plans(name, slug, plan_type, features, price, badge_icon_url)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Handle return from the payment gateway (?success=true / ?canceled=true)
  useEffect(() => {
    const success = searchParams.get("success");
    const canceled = searchParams.get("canceled");
    if (!success && !canceled) return;
    if (success === "true") {
      toast({
        title: "Payment received!",
        description: "Your membership will activate within a minute. This page refreshes automatically.",
      });
      queryClient.invalidateQueries({ queryKey: ["my-all-memberships"] });
      queryClient.invalidateQueries({ queryKey: ["sidebar-membership"] });
      // The webhook may lag behind the redirect — poll a few times (self-terminating)
      let attempts = 0;
      const timer = setInterval(() => {
        attempts++;
        queryClient.invalidateQueries({ queryKey: ["my-all-memberships"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar-membership"] });
        if (attempts >= 5) clearInterval(timer);
      }, 4000);
    } else if (canceled === "true") {
      toast({ title: "Payment cancelled", description: "You were not charged.", variant: "destructive" });
    }
    setSearchParams({}, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const { data: plans = [] } = useQuery({
    queryKey: ["membership-plans"],
    queryFn: async () => {
      const { data, error } = await supabase.from("membership_plans").select("*").eq("is_active", true).order("price");
      if (error) throw error;
      return data;
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

  const { data: allowedBilling = ["monthly", "yearly"] } = useQuery({
    queryKey: ["membership-billing-modes"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "service_billing_membership").single();
      return (data?.value || "monthly,yearly").split(",").filter(Boolean) as BillingInterval[];
    },
  });

  const { data: discountPercent } = useQuery({
    queryKey: ["yearly-discount"],
    queryFn: async () => {
      const { data } = await supabase.from("site_settings").select("value").eq("key", "yearly_discount_percent").single();
      return Number(data?.value || 20);
    },
  });

  const effectiveBilling = allowedBilling.includes(billingInterval) ? billingInterval : allowedBilling[0] || "yearly";
  useEffect(() => {
    if (effectiveBilling !== billingInterval) {
      setBillingInterval(effectiveBilling as BillingInterval);
    }
  }, [effectiveBilling, billingInterval]);

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
        body: { planId, billingInterval: effectiveBilling, provider },
      });

      if (error) throw new Error(await parseFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (data?.checkout || data?.url) {
        await completeCheckout(data);
      } else if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ["my-all-memberships"] });
        queryClient.invalidateQueries({ queryKey: ["sidebar-membership"] });
        toast({ title: "Membership activated!", description: `You are now a ${plan.name}` });
      } else {
        throw new Error("The payment provider did not return a checkout link. Please try again or contact support.");
      }
    },
    onMutate: ({ planId, provider }) => setPendingCheckout(`${planId}-${provider}`),
    onSettled: () => setPendingCheckout(null),
    onError: (e: any) => toast({ title: "Checkout error", description: e.message, variant: "destructive" }),
  });

  const activeMemberships = myMemberships.filter((m: any) => m.status === "active" && new Date(m.expires_at) > new Date());
  const expiredMemberships = myMemberships.filter((m: any) => m.status !== "active" || new Date(m.expires_at) <= new Date());

  const hasActivePlan = (planSlug: string) =>
    activeMemberships.some((m: any) => (m as any).membership_plans?.slug === planSlug);

  const getPrice = (plan: any) => {
    const adminMonthly = servicePrices?.["service_price_membership_monthly"];
    const adminYearly = servicePrices?.["service_price_membership_yearly"];
    const adminOneTime = servicePrices?.["service_price_membership_one_time"];

    if (effectiveBilling === "monthly") {
      if (adminMonthly) return parseFloat(adminMonthly);
      return plan.monthly_price && plan.monthly_price > 0 ? plan.monthly_price : Math.ceil((plan.price / 12) * 100) / 100;
    }
    if (effectiveBilling === "one_time") {
      if (adminOneTime) return parseFloat(adminOneTime);
      return plan.price;
    }
    if (adminYearly) return parseFloat(adminYearly);
    return plan.price;
  };

  const getIntervalLabel = () => {
    if (effectiveBilling === "monthly") return "/mo";
    if (effectiveBilling === "yearly") return "/yr";
    return "";
  };

  const getButtonLabel = (plan: any) => {
    const price = getPrice(plan).toFixed(2);
    if (effectiveBilling === "one_time") return `Pay $${price} One-Time`;
    return `Subscribe for $${price}${getIntervalLabel()}`;
  };

  const cardProvider = getCardProvider(activeGateways);

  useEffect(() => {
    if (location.hash === "#upgrade-plans") {
      document.getElementById("upgrade-plans")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash, plans.length]);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <main className="flex-1 overflow-y-auto p-6 lg:p-10">
        <h1 className="font-display text-2xl font-bold text-foreground">My Membership</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage your membership plans and benefits</p>

        {loadingMemberships && (
          <div className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading your memberships…
          </div>
        )}
        {membershipsError && (
          <p className="mt-6 text-sm text-destructive">Could not load your memberships. Please refresh the page.</p>
        )}

        {/* Active Memberships */}
        {activeMemberships.length > 0 && (
          <div className="mt-6 space-y-4">
            <h2 className="font-display text-lg font-semibold text-foreground">Active Plans</h2>
            {activeMemberships.map((m: any) => (
              <Card key={m.id} className="border-primary/30 bg-primary/5">
                <CardContent className="flex items-center justify-between p-5">
                  <div className="flex items-center gap-4">
                    {(m as any).membership_plans?.plan_type === "partner" ? (
                      <Crown className="h-8 w-8 text-accent" />
                    ) : (
                      <Shield className="h-8 w-8 text-primary" />
                    )}
                    <div>
                      <p className="font-display text-lg font-bold text-foreground">{(m as any).membership_plans?.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <CalendarDays className="h-3.5 w-3.5" />
                        {m.billing_interval === "one_time" ? "Lifetime access" : `Expires ${new Date(m.expires_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Available Plans */}
        <div id="upgrade-plans" className="mt-8 scroll-mt-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2 className="font-display text-lg font-semibold text-foreground">
              {activeMemberships.length > 0 ? "Upgrade or Add Plans" : "Choose a Plan"}
            </h2>
            {allowedBilling.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap">
                {allowedBilling.map((bt) => (
                  <button
                    key={bt}
                    onClick={() => setBillingInterval(bt as BillingInterval)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                      billingInterval === bt
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                    }`}
                  >
                    {bt === "monthly" ? "Monthly" : bt === "yearly" ? "Yearly" : "One-Time"}
                    {bt === "yearly" && allowedBilling.includes("monthly") && (
                      <Badge variant="secondary" className="ml-1 text-xs">Save {discountPercent || 20}%</Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            {plans.map((plan: any) => {
              const subscribed = hasActivePlan(plan.slug);
              const features = Array.isArray(plan.features) ? plan.features : [];
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
                      <p className="text-sm text-muted-foreground mt-1">One-time payment</p>
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
                        <Badge className="w-full justify-center bg-green-100 py-2 text-green-800">Active</Badge>
                      ) : activeGateways.length === 0 ? (
                        <Button className="w-full" disabled>Payment not configured</Button>
                      ) : (
                        <div className="space-y-2">
                          {cardProvider && (
                            <Button
                              className="w-full gap-2"
                              onClick={() => subscribeMutation.mutate({ planId: plan.id, provider: cardProvider })}
                              disabled={!!pendingCheckout}
                            >
                              {pendingCheckout === `${plan.id}-${cardProvider}` ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  Pay with {getPaymentProviderLabel(cardProvider)} — {getButtonLabel(plan)}
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
                            </Button>
                          )}
                          {activeGateways.includes("paypal") && (
                            <Button
                              variant="outline"
                              className="w-full gap-2 border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba] hover:text-white"
                              onClick={() => subscribeMutation.mutate({ planId: plan.id, provider: "paypal" })}
                              disabled={!!pendingCheckout}
                            >
                              {pendingCheckout === `${plan.id}-paypal` ? (
                                <>
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  Processing...
                                </>
                              ) : (
                                <>
                                  Pay with PayPal — ${getPrice(plan).toFixed(2)}
                                  {getIntervalLabel()}
                                  <ArrowRight className="h-4 w-4" />
                                </>
                              )}
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
        </div>

        {/* History */}
        {expiredMemberships.length > 0 && (
          <div className="mt-8">
            <h2 className="font-display text-lg font-semibold text-foreground">Membership History</h2>
            <div className="mt-4 space-y-3">
              {expiredMemberships.map((m: any) => (
                <Card key={m.id}>
                  <CardContent className="flex items-center justify-between p-4">
                    <div>
                      <p className="font-semibold">{(m as any).membership_plans?.name || "Plan"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(m.starts_at).toLocaleDateString()} — {new Date(m.expires_at).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-muted-foreground capitalize">
                      {m.status !== "active" ? m.status : "Expired"}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardMembership;
