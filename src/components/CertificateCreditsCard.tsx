import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, ShoppingCart, Loader2, FileText, Baby } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { completeCheckout } from "@/lib/airwallexCheckout";
import {
  filterVisiblePaymentProviders,
  getCardProvider,
  getPaymentProviderLabel,
  parseFunctionError,
  type PaymentProvider,
} from "@/lib/paymentProviders";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  CREDIT_PRODUCT_LABELS,
  CREDIT_PRODUCT_PRICE_KEYS,
  DEFAULT_CERTIFICATE_PRICES,
  getUniversalCredits,
  type CreditProductType,
} from "@/lib/certificateTypes";

const RETAIL_PRODUCTS: CreditProductType[] = ["ownership", "birth", "bundle"];
const RESELLER_PRODUCTS: CreditProductType[] = [
  "ownership_pack_10",
  "birth_pack_10",
  "reseller_mixed_pack_10",
];

const CertificateCreditsCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<CreditProductType>("ownership");
  const [quantity, setQuantity] = useState(1);
  const [pendingProvider, setPendingProvider] = useState<PaymentProvider | null>(null);
  const [claiming, setClaiming] = useState(false);

  const { data: credits } = useQuery({
    queryKey: ["my-cert-credits", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("certificate_credits" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data as any;
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["my-profile-reseller", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("is_certificate_reseller")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: hasMembership } = useQuery({
    queryKey: ["my-active-membership", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("memberships")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .maybeSingle();
      return !!data;
    },
  });

  const { data: pricingMap = {} } = useQuery({
    queryKey: ["cert-prices-all"],
    queryFn: async () => {
      const keys = Object.values(CREDIT_PRODUCT_PRICE_KEYS);
      const { data } = await supabase.from("site_settings").select("key, value").in("key", [
        ...keys,
        "service_price_certificate_one_time",
      ]);
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        map[row.key] = parseFloat(row.value);
      });
      return map;
    },
  });

  const getPrice = (product: CreditProductType) =>
    pricingMap[CREDIT_PRODUCT_PRICE_KEYS[product]] ?? DEFAULT_CERTIFICATE_PRICES[product];

  const { data: gateways = [] } = useQuery({
    queryKey: ["active-payment-gateways"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_settings_safe" as any)
        .select("provider, is_active") as any;
      return filterVisiblePaymentProviders(
        ((data || []) as any[]).filter((g) => g.is_active).map((g: any) => g.provider),
      );
    },
  });

  useEffect(() => {
    if (!user || !hasMembership || claiming) return;
    if (credits?.free_credit_claimed) return;
    setClaiming(true);
    (async () => {
      try {
        const { data, error } = await supabase.rpc("claim_free_certificate_credit" as any, { _user_id: user.id });
        if (error) {
          console.error("Free credit claim failed:", error);
          return;
        }
        if (data) {
          queryClient.invalidateQueries({ queryKey: ["my-cert-credits", user.id] });
          toast.success("Member free certificate credit claimed!");
        }
      } finally {
        setClaiming(false);
      }
    })();
  }, [user, hasMembership, credits, claiming, queryClient]);

  const handleBuy = async (provider: PaymentProvider) => {
    if (!user) return;
    setPendingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke("certificate-checkout", {
        body: { user_id: user.id, quantity, provider, credit_type: selectedProduct },
      });
      if (error) throw new Error(await parseFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (data?.checkout || data?.url) {
        await completeCheckout(data);
      } else {
        throw new Error("The payment provider did not return a checkout link. Please try again or contact support.");
      }
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setPendingProvider(null);
    }
  };

  const cardProvider = getCardProvider(gateways);
  const hasPayPal = gateways.includes("paypal");
  const canCheckout = !!cardProvider || hasPayPal;
  const isReseller = !!profile?.is_certificate_reseller;
  const total = getPrice(selectedProduct) * quantity;

  const ProductButton = ({ product }: { product: CreditProductType }) => (
    <button
      type="button"
      onClick={() => setSelectedProduct(product)}
      className={`rounded-lg border-2 p-3 text-left transition-all ${
        selectedProduct === product ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "border-border hover:border-primary/40"
      }`}
    >
      <div className="flex items-center gap-2 mb-1">
        {product.includes("birth") ? (
          <Baby className="h-4 w-4 text-orange-500" />
        ) : (
          <FileText className="h-4 w-4 text-amber-600" />
        )}
        <span className="text-sm font-semibold">{CREDIT_PRODUCT_LABELS[product]}</span>
      </div>
      <p className="text-lg font-bold">${getPrice(product).toFixed(0)}</p>
    </button>
  );

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Coins className="h-5 w-5 text-amber-500" /> Certificate Credits</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-lg border bg-card p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Certificate credits</p>
            <Badge variant="secondary" className="text-2xl font-bold px-4 py-1">
              {getUniversalCredits(credits)}
            </Badge>
            <p className="text-xs text-muted-foreground mt-2">Each credit issues one ownership or birth certificate</p>
          </div>
          <p className="text-sm text-muted-foreground">
            One credit = one official certificate — your choice of ownership or birth.
            {hasMembership && !credits?.free_credit_claimed && (
              <span className="block text-primary font-medium mt-1">Claiming your free certificate credit…</span>
            )}
            {hasMembership && credits?.free_credit_claimed && (
              <span className="block text-green-600 font-medium mt-1">✓ Member free certificate credit claimed</span>
            )}
          </p>
          <Button onClick={() => setBuyOpen(true)} className="w-full gap-2" size="sm">
            <ShoppingCart className="h-4 w-4" /> Buy Credits
          </Button>
        </CardContent>
      </Card>

      <Dialog open={buyOpen} onOpenChange={(open) => !pendingProvider && setBuyOpen(open)}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Buy certificate credits
            </DialogTitle>
            <DialogDescription>
              Choose a product, then pay securely. Credits are applied to your account instantly after payment.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {RETAIL_PRODUCTS.map((p) => <ProductButton key={p} product={p} />)}
            </div>
            {isReseller && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-2">Shop / reseller packs</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {RESELLER_PRODUCTS.map((p) => <ProductButton key={p} product={p} />)}
                </div>
              </div>
            )}
            <div>
              <label className="text-sm font-medium">Quantity (packs)</label>
              <Input
                type="number"
                min="1"
                max="20"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                className="mt-1"
              />
            </div>
            <div className="rounded-lg bg-muted p-3 flex justify-between items-center">
              <span className="text-sm text-muted-foreground">{CREDIT_PRODUCT_LABELS[selectedProduct]}</span>
              <span className="text-xl font-bold text-foreground">${total.toFixed(2)}</span>
            </div>
            {!canCheckout ? (
              <p className="text-sm text-destructive text-center">No payment gateway configured</p>
            ) : (
              <div className="space-y-2">
                {cardProvider && (
                  <Button className="w-full gap-2" disabled={!!pendingProvider} onClick={() => handleBuy(cardProvider)}>
                    {pendingProvider === cardProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Pay with {getPaymentProviderLabel(cardProvider)} — ${total.toFixed(2)}
                  </Button>
                )}
                {hasPayPal && (
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-[#0070ba] text-[#0070ba] hover:bg-[#0070ba] hover:text-white"
                    disabled={!!pendingProvider}
                    onClick={() => handleBuy("paypal")}
                  >
                    {pendingProvider === "paypal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Pay with PayPal — ${total.toFixed(2)}
                  </Button>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateCreditsCard;
