import AdminSidebar from "@/components/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Percent, DollarSign, Settings2, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";

const STRIPE_UI_ENABLED = false;

const AIRWALLEX_ENV_OPTIONS = [
  { value: "demo", label: "Demo / Sandbox" },
  { value: "prod", label: "Production (Live)" },
];

const SERVICES = [
  { key: "membership", label: "Membership Plans", description: "Guardian & Partner membership billing" },
  { key: "flyer", label: "Flyer Builder", description: "Lost pet flyer design service" },
  { key: "certificate", label: "Pet Certificate", description: "Official registration certificate" },
  { key: "directory", label: "Directory Listing", description: "Business directory listing fee" },
];

// Each option describes exactly which billing types are enabled
const BILLING_MODE_OPTIONS = [
  { value: "one_time", label: "One-Time Fee Only", types: ["one_time"] },
  { value: "monthly", label: "Monthly Subscription Only", types: ["monthly"] },
  { value: "yearly", label: "Yearly Subscription Only", types: ["yearly"] },
  { value: "monthly,yearly", label: "Monthly + Yearly", types: ["monthly", "yearly"] },
  { value: "monthly,one_time", label: "Monthly + One-Time", types: ["monthly", "one_time"] },
  { value: "yearly,one_time", label: "Yearly + One-Time", types: ["yearly", "one_time"] },
  { value: "monthly,yearly,one_time", label: "All (Monthly + Yearly + One-Time)", types: ["monthly", "yearly", "one_time"] },
];

const AdminPayments = () => {
  const queryClient = useQueryClient();
  const [stripePublishable, setStripePublishable] = useState("");
  const [stripeSecret, setStripeSecret] = useState("");
  const [stripeActive, setStripeActive] = useState(false);
  const [paypalClient, setPaypalClient] = useState("");
  const [paypalSecret, setPaypalSecret] = useState("");
  const [paypalActive, setPaypalActive] = useState(false);
  const [airwallexClientId, setAirwallexClientId] = useState("");
  const [airwallexApiKey, setAirwallexApiKey] = useState("");
  const [airwallexActive, setAirwallexActive] = useState(false);
  const [airwallexEnv, setAirwallexEnv] = useState("demo");
  const [airwallexAccountId, setAirwallexAccountId] = useState("");
  const [saving, setSaving] = useState(false);

  const [yearlyDiscount, setYearlyDiscount] = useState("20");
  const [savingServices, setSavingServices] = useState(false);

  // Per-service state: billing mode string + prices
  const [servicePricing, setServicePricing] = useState<Record<string, { billingMode: string; monthly: string; yearly: string; one_time: string }>>({});

  const { data: allSettings = [] } = useQuery({
    queryKey: ["all-payment-settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("*")
        .or("key.like.service_billing_%,key.like.service_price_%,key.eq.yearly_discount_percent,key.eq.flyer_monthly_price,key.eq.flyer_yearly_price,key.eq.airwallex_environment,key.eq.airwallex_account_id");
      return data || [];
    },
  });

  useEffect(() => {
    const getVal = (key: string, fallback: string) => {
      const found = allSettings.find((s: any) => s.key === key);
      return found?.value || fallback;
    };

    setYearlyDiscount(getVal("yearly_discount_percent", "20"));
    setAirwallexEnv(getVal("airwallex_environment", "demo"));
    setAirwallexAccountId(getVal("airwallex_account_id", ""));

    const newPricing: Record<string, { billingMode: string; monthly: string; yearly: string; one_time: string }> = {};
    for (const svc of SERVICES) {
      const defaultMode = svc.key === "certificate" || svc.key === "directory" ? "one_time" : "monthly,yearly";
      const billingMode = getVal(`service_billing_${svc.key}`, defaultMode);
      newPricing[svc.key] = {
        billingMode,
        monthly: svc.key === "flyer"
          ? getVal("flyer_monthly_price", getVal(`service_price_${svc.key}_monthly`, "1"))
          : getVal(`service_price_${svc.key}_monthly`, "5"),
        yearly: svc.key === "flyer"
          ? getVal("flyer_yearly_price", getVal(`service_price_${svc.key}_yearly`, "10"))
          : getVal(`service_price_${svc.key}_yearly`, "50"),
        one_time: getVal(`service_price_${svc.key}_one_time`, "5"),
      };
    }
    setServicePricing(newPricing);
  }, [allSettings]);

  const { data: settings } = useQuery({
    queryKey: ["payment-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_settings_safe" as any).select("provider, publishable_key, is_active, updated_at") as any;
      if (error) throw error;
      return data as { provider: string; publishable_key: string | null; is_active: boolean; updated_at: string }[];
    },
  });

  // Check if a real secret is saved (not just the publishable key)
  const { data: secretStatus } = useQuery({
    queryKey: ["payment-secret-status"],
    queryFn: async () => {
      const { data } = await supabase.from("payment_settings").select("provider, secret_key");
      const result: Record<string, boolean> = { stripe: false, paypal: false, airwallex: false };
      (data || []).forEach((row: any) => {
        result[row.provider] = !!(row.secret_key && row.secret_key.length > 10);
      });
      return result;
    },
  });

  const stripeSettings = settings?.find((s) => s.provider === "stripe");
  const paypalSettings = settings?.find((s) => s.provider === "paypal");
  const airwallexSettings = settings?.find((s) => s.provider === "airwallex");
  const stripeReady = !!stripeSettings?.publishable_key && !!secretStatus?.stripe;
  const paypalReady = !!paypalSettings?.publishable_key && !!secretStatus?.paypal;
  const airwallexReady = !!airwallexSettings?.publishable_key && !!secretStatus?.airwallex;

  const [testing, setTesting] = useState<string | null>(null);
  const testGateway = async (provider: "airwallex" | "paypal" | "stripe") => {
    setTesting(provider);
    try {
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const { data: { session } } = await supabase.auth.getSession();
      // Use certificate-checkout with a tiny test payload — it validates keys before contacting the gateway
      const res = await fetch(`${baseUrl}/functions/v1/certificate-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ user_id: session?.user?.id, quantity: 1, provider }),
      });
      const result = await res.json();
      if (res.ok && (result.url || result.checkout)) {
        toast.success(`✓ ${provider === "airwallex" ? "Airwallex" : provider === "stripe" ? "Stripe" : "PayPal"} connection works!`);
      } else {
        toast.error(result.error || `${provider} test failed`);
      }
    } catch (e: any) {
      toast.error(e.message || "Test failed");
    } finally {
      setTesting(null);
    }
  };

  useEffect(() => {
    if (settings) {
      const stripe = settings.find((s) => s.provider === "stripe");
      const paypal = settings.find((s) => s.provider === "paypal");
      if (stripe) { setStripePublishable(stripe.publishable_key || ""); setStripeActive(stripe.is_active); }
      if (paypal) { setPaypalClient(paypal.publishable_key || ""); setPaypalActive(paypal.is_active); }
      const airwallex = settings.find((s) => s.provider === "airwallex");
      if (airwallex) { setAirwallexClientId(airwallex.publishable_key || ""); setAirwallexActive(airwallex.is_active); }
    }
  }, [settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const baseUrl = import.meta.env.VITE_SUPABASE_URL;
      const normalizedStripePublishable = stripePublishable.trim();
      const normalizedStripeSecret = stripeSecret.trim();
      const normalizedPaypalClient = paypalClient.trim();
      const normalizedPaypalSecret = paypalSecret.trim();
      const normalizedAirwallexClientId = airwallexClientId.trim();
      const normalizedAirwallexApiKey = airwallexApiKey.trim();

      if (STRIPE_UI_ENABLED) {
        if (normalizedStripePublishable && !normalizedStripePublishable.startsWith("pk_")) {
          throw new Error("Stripe publishable key must start with pk_.");
        }
        if (normalizedStripeSecret && !normalizedStripeSecret.startsWith("sk_")) {
          throw new Error("Stripe secret key must start with sk_.");
        }
        const stripeResponse = await fetch(`${baseUrl}/functions/v1/save-payment-settings`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
          body: JSON.stringify({
            provider: "stripe",
            publishable_key: normalizedStripePublishable,
            secret_key: normalizedStripeSecret,
            is_active: stripeActive,
          }),
        });
        const stripeResult = await stripeResponse.json().catch(() => ({}));
        if (!stripeResponse.ok) {
          throw new Error(stripeResult.error || "Failed to save Stripe settings");
        }
      }

      const airwallexResponse = await fetch(`${baseUrl}/functions/v1/save-payment-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: "airwallex",
          publishable_key: normalizedAirwallexClientId,
          secret_key: normalizedAirwallexApiKey,
          is_active: airwallexActive,
        }),
      });
      const airwallexResult = await airwallexResponse.json().catch(() => ({}));
      if (!airwallexResponse.ok) {
        throw new Error(airwallexResult.error || "Failed to save Airwallex settings");
      }

      for (const row of [
        { key: "airwallex_environment", value: airwallexEnv, description: "Airwallex API environment" },
        { key: "airwallex_account_id", value: airwallexAccountId.trim(), description: "Airwallex x-login-as account ID (optional)" },
      ]) {
        const { data: existing } = await supabase.from("site_settings").select("id").eq("key", row.key).maybeSingle();
        if (existing) {
          await supabase.from("site_settings").update({ value: row.value }).eq("key", row.key);
        } else {
          await supabase.from("site_settings").insert(row);
        }
      }

      const paypalResponse = await fetch(`${baseUrl}/functions/v1/save-payment-settings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({
          provider: "paypal",
          publishable_key: normalizedPaypalClient,
          secret_key: normalizedPaypalSecret,
          is_active: paypalActive,
        }),
      });
      const paypalResult = await paypalResponse.json().catch(() => ({}));
      if (!paypalResponse.ok) {
        throw new Error(paypalResult.error || "Failed to save PayPal settings");
      }

      setStripeSecret("");
      setPaypalSecret("");
      setAirwallexApiKey("");
      queryClient.invalidateQueries({ queryKey: ["payment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["payment-secret-status"] });
      toast.success("✓ Payment settings saved! Use the Test buttons to verify the connection.");
    } catch (error: any) {
      toast.error(error.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const getActiveTypes = (billingMode: string): string[] => billingMode.split(",").filter(Boolean);

  const handleSaveServicePricing = async () => {
    setSavingServices(true);
    try {
      const upserts: { key: string; value: string; description: string }[] = [
        { key: "yearly_discount_percent", value: yearlyDiscount, description: "Yearly discount percentage" },
      ];

      for (const svc of SERVICES) {
        const pricing = servicePricing[svc.key];
        if (!pricing) continue;
        upserts.push(
          { key: `service_billing_${svc.key}`, value: pricing.billingMode, description: `Billing mode for ${svc.label}` },
          { key: `service_price_${svc.key}_monthly`, value: pricing.monthly, description: `Monthly price for ${svc.label}` },
          { key: `service_price_${svc.key}_yearly`, value: pricing.yearly, description: `Yearly price for ${svc.label}` },
          { key: `service_price_${svc.key}_one_time`, value: pricing.one_time, description: `One-time price for ${svc.label}` },
        );
        // Sync legacy keys for backward compatibility
        if (svc.key === "flyer") {
          upserts.push(
            { key: "flyer_monthly_price", value: pricing.monthly, description: "Flyer monthly price" },
            { key: "flyer_yearly_price", value: pricing.yearly, description: "Flyer yearly price" },
            { key: "flyer_fee", value: pricing.one_time, description: "Flyer one-time fee (legacy)" },
          );
        }
        if (svc.key === "certificate") {
          upserts.push(
            { key: "certificate_fee", value: pricing.one_time, description: "Certificate fee (legacy)" },
          );
        }
      }

      for (const u of upserts) {
        const { data: existing } = await supabase.from("site_settings").select("id").eq("key", u.key).maybeSingle();
        if (existing) {
          await supabase.from("site_settings").update({ value: u.value }).eq("key", u.key);
        } else {
          await supabase.from("site_settings").insert(u);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["all-payment-settings"] });
      queryClient.invalidateQueries({ queryKey: ["billing-settings"] });
      toast.success("Service pricing saved!");
    } catch {
      toast.error("Failed to save service pricing");
    } finally {
      setSavingServices(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <main className="flex-1 bg-background p-6 md:p-8 overflow-y-auto">
        <h1 className="font-display text-2xl font-bold text-foreground">Payment Settings</h1>
        <p className="text-sm text-muted-foreground">Configure payment gateways, billing modes, and service pricing</p>

        {/* Payment Gateway Section */}
        <form onSubmit={handleSave} className="mt-8 max-w-2xl space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-primary" />Airwallex Integration
                  {airwallexReady ? (
                    <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1"><AlertCircle className="h-3 w-3" /> Not configured</Badge>
                  )}
                  {airwallexSettings?.is_active && <Badge variant="secondary" className="text-xs">Active</Badge>}
                </CardTitle>
                <Switch checked={airwallexActive} onCheckedChange={setAirwallexActive} />
              </div>
              {airwallexSettings?.updated_at && (
                <p className="text-xs text-muted-foreground">Last saved: {new Date(airwallexSettings.updated_at).toLocaleString()}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Primary card payments for PetsRegistry. Funds settle to your company Airwallex account.
              </p>
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select value={airwallexEnv} onValueChange={setAirwallexEnv}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AIRWALLEX_ENV_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Client ID</Label><Input type="text" placeholder="Your Airwallex Client ID" value={airwallexClientId} onChange={(e) => setAirwallexClientId(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>API Key {secretStatus?.airwallex && <span className="text-xs text-green-600 ml-1">✓ stored</span>}</Label>
                <Input type="password" placeholder={secretStatus?.airwallex ? "•••••••• (saved — enter new value to replace)" : "Your Airwallex API Key"} value={airwallexApiKey} onChange={(e) => setAirwallexApiKey(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Account ID (optional)</Label>
                <Input type="text" placeholder="x-login-as account ID if your API key spans multiple accounts" value={airwallexAccountId} onChange={(e) => setAirwallexAccountId(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">
                Webhook URL: <code className="rounded bg-muted px-1">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/airwallex-webhook</code>
              </p>
              {airwallexReady && (
                <Button type="button" variant="outline" size="sm" disabled={testing === "airwallex"} onClick={() => testGateway("airwallex")}>
                  {testing === "airwallex" ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing…</> : "Test Airwallex Connection"}
                </Button>
              )}
            </CardContent>
          </Card>

          {STRIPE_UI_ENABLED && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-muted-foreground" />Stripe Integration (legacy)
                  {stripeReady ? (
                    <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1"><AlertCircle className="h-3 w-3" /> Not configured</Badge>
                  )}
                  {stripeSettings?.is_active && <Badge variant="secondary" className="text-xs">Active</Badge>}
                </CardTitle>
                <Switch checked={stripeActive} onCheckedChange={setStripeActive} />
              </div>
              {stripeSettings?.updated_at && (
                <p className="text-xs text-muted-foreground">Last saved: {new Date(stripeSettings.updated_at).toLocaleString()}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Publishable Key</Label><Input type="text" placeholder="pk_live_..." value={stripePublishable} onChange={(e) => setStripePublishable(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Secret Key {secretStatus?.stripe && <span className="text-xs text-green-600 ml-1">✓ stored</span>}</Label>
                <Input type="password" placeholder={secretStatus?.stripe ? "•••••••• (saved — enter new value to replace)" : "sk_live_... or sk_test_..."} value={stripeSecret} onChange={(e) => setStripeSecret(e.target.value)} />
                <p className="text-xs text-muted-foreground">Secret keys are write-only for security. Leave blank to keep existing.</p>
              </div>
              {stripeReady && (
                <Button type="button" variant="outline" size="sm" disabled={testing === "stripe"} onClick={() => testGateway("stripe")}>
                  {testing === "stripe" ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing…</> : "Test Stripe Connection"}
                </Button>
              )}
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-accent" />PayPal Integration
                  {paypalReady ? (
                    <Badge className="bg-green-600 text-white gap-1"><CheckCircle2 className="h-3 w-3" /> Saved</Badge>
                  ) : (
                    <Badge variant="outline" className="text-amber-600 border-amber-400 gap-1"><AlertCircle className="h-3 w-3" /> Not configured</Badge>
                  )}
                  {paypalSettings?.is_active && <Badge variant="secondary" className="text-xs">Active</Badge>}
                </CardTitle>
                <Switch checked={paypalActive} onCheckedChange={setPaypalActive} />
              </div>
              {paypalSettings?.updated_at && (
                <p className="text-xs text-muted-foreground">Last saved: {new Date(paypalSettings.updated_at).toLocaleString()}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2"><Label>Client ID</Label><Input type="text" placeholder="Your PayPal Client ID" value={paypalClient} onChange={(e) => setPaypalClient(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Client Secret {secretStatus?.paypal && <span className="text-xs text-green-600 ml-1">✓ stored</span>}</Label>
                <Input type="password" placeholder={secretStatus?.paypal ? "•••••••• (saved — enter new value to replace)" : "Your PayPal Client Secret"} value={paypalSecret} onChange={(e) => setPaypalSecret(e.target.value)} />
                <p className="text-xs text-muted-foreground">Secrets are write-only for security. Leave blank to keep existing.</p>
              </div>
              {paypalReady && (
                <Button type="button" variant="outline" size="sm" disabled={testing === "paypal"} onClick={() => testGateway("paypal")}>
                  {testing === "paypal" ? <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Testing…</> : "Test PayPal Connection"}
                </Button>
              )}
            </CardContent>
          </Card>

          <Button type="submit" size="lg" disabled={saving}>{saving ? "Saving..." : "Save Payment Settings"}</Button>
        </form>

        {/* Service Pricing Configuration */}
        <div className="mt-10 max-w-3xl">
          <h2 className="font-display text-xl font-bold text-foreground mb-2 flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" /> Service Pricing & Billing Modes
          </h2>
          <p className="text-sm text-muted-foreground mb-4">Choose how you want to charge for each service. Pick a billing mode, then set the price. You can change this anytime.</p>

          {/* Global yearly discount */}
          <Card className="mb-4">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <Percent className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1">
                  <Label className="font-semibold">Yearly Discount (%)</Label>
                  <p className="text-xs text-muted-foreground">Discount shown when yearly is available alongside monthly</p>
                </div>
                <Input type="number" min="0" max="100" className="w-24" value={yearlyDiscount} onChange={(e) => setYearlyDiscount(e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {SERVICES.map(svc => {
              const pricing = servicePricing[svc.key];
              if (!pricing) return null;
              const activeTypes = getActiveTypes(pricing.billingMode);
              const showMonthly = activeTypes.includes("monthly");
              const showYearly = activeTypes.includes("yearly");
              const showOneTime = activeTypes.includes("one_time");

              return (
                <Card key={svc.key}>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-primary" />
                      {svc.label}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground">{svc.description}</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Billing Mode Dropdown */}
                    <div>
                      <Label className="text-sm font-medium mb-2 block">How do you want to charge?</Label>
                      <Select
                        value={pricing.billingMode}
                        onValueChange={(val) =>
                          setServicePricing(prev => ({
                            ...prev,
                            [svc.key]: { ...prev[svc.key], billingMode: val },
                          }))
                        }
                      >
                        <SelectTrigger className="w-full max-w-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {BILLING_MODE_OPTIONS.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Price Inputs — only for the selected billing types */}
                    <div className="grid grid-cols-3 gap-3">
                      {showMonthly && (
                        <div className="space-y-1">
                          <Label className="text-xs">Monthly Price ($)</Label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={pricing.monthly}
                            onChange={(e) => setServicePricing(prev => ({ ...prev, [svc.key]: { ...prev[svc.key], monthly: e.target.value } }))}
                          />
                        </div>
                      )}
                      {showYearly && (
                        <div className="space-y-1">
                          <Label className="text-xs">Yearly Price ($)</Label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={pricing.yearly}
                            onChange={(e) => setServicePricing(prev => ({ ...prev, [svc.key]: { ...prev[svc.key], yearly: e.target.value } }))}
                          />
                        </div>
                      )}
                      {showOneTime && (
                        <div className="space-y-1">
                          <Label className="text-xs">One-Time Fee ($)</Label>
                          <Input
                            type="number" step="0.01" min="0"
                            value={pricing.one_time}
                            onChange={(e) => setServicePricing(prev => ({ ...prev, [svc.key]: { ...prev[svc.key], one_time: e.target.value } }))}
                          />
                        </div>
                      )}
                    </div>

                    {/* Summary badges */}
                    <div className="flex flex-wrap gap-2">
                      {showMonthly && <Badge variant="outline" className="text-xs">Monthly: ${pricing.monthly}</Badge>}
                      {showYearly && <Badge variant="outline" className="text-xs">Yearly: ${pricing.yearly}</Badge>}
                      {showOneTime && <Badge variant="outline" className="text-xs">One-Time: ${pricing.one_time}</Badge>}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>How it works:</strong> Monthly & Yearly memberships are paid via Airwallex (one payment per period).
              One-Time uses a single Airwallex checkout. PayPal remains available if enabled.
            </p>
          </div>

          <Button
            onClick={handleSaveServicePricing}
            disabled={savingServices}
            size="lg"
            className="mt-4"
          >
            {savingServices ? "Saving..." : "Save All Service Pricing"}
          </Button>
        </div>
      </main>
    </div>
  );
};

export default AdminPayments;
