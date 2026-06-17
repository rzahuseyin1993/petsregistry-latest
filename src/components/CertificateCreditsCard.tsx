import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, ShoppingCart, Loader2 } from "lucide-react";
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

const CertificateCreditsCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
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

  const { data: pricing } = useQuery({
    queryKey: ["cert-price"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "service_price_certificate_one_time")
        .maybeSingle();
      return parseFloat(data?.value || "15");
    },
  });

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

  // Auto-claim free credit on load
  useEffect(() => {
    if (!user || !hasMembership || claiming) return;
    if (credits?.free_credit_claimed) return;
    setClaiming(true);
    (async () => {
      try {
        const { data } = await supabase.rpc("claim_free_certificate_credit" as any, { _user_id: user.id });
        if (data) {
          queryClient.invalidateQueries({ queryKey: ["my-cert-credits", user.id] });
          toast.success("🎁 Member free certificate credit claimed!");
        }
      } finally {
        setClaiming(false);
      }
    })();
  }, [user, hasMembership, credits]);

  const handleBuy = async (provider: PaymentProvider) => {
    if (!user) return;
    setPendingProvider(provider);
    try {
      const { data, error } = await supabase.functions.invoke("certificate-checkout", {
        body: { user_id: user.id, quantity, provider },
      });
      if (error) throw new Error(await parseFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (data?.checkout || data?.url) {
        await completeCheckout(data);
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

  const total = (pricing || 15) * quantity;

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center justify-between text-base">
            <span className="flex items-center gap-2"><Coins className="h-5 w-5 text-amber-500" /> Certificate Credits</span>
            <Badge variant="secondary" className="text-lg font-bold px-3">{credits?.credits || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            1 credit = 1 certificate. {hasMembership && credits?.free_credit_claimed && (
              <span className="text-green-600 font-medium">✓ Member free credit claimed</span>
            )}
            {hasMembership && !credits?.free_credit_claimed && (
              <span className="text-primary font-medium">🎁 Claiming your free member credit...</span>
            )}
          </p>
          <Button onClick={() => setBuyOpen(true)} className="w-full gap-2" size="sm">
            <ShoppingCart className="h-4 w-4" /> Buy Credits (${pricing || 15} each)
          </Button>
          {credits?.lifetime_purchased > 0 && (
            <p className="text-xs text-muted-foreground text-center">Lifetime purchased: {credits.lifetime_purchased}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={buyOpen} onOpenChange={(open) => !pendingProvider && setBuyOpen(open)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Choose payment method
            </DialogTitle>
            <DialogDescription>
              Buy <span className="font-semibold text-foreground">{quantity}</span> certificate credit
              {quantity === 1 ? "" : "s"} for <span className="font-semibold text-foreground">${total.toFixed(2)}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Quantity</label>
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
              <span className="text-sm text-muted-foreground">Total</span>
              <span className="text-xl font-bold text-foreground">${total.toFixed(2)}</span>
            </div>
            {!canCheckout ? (
              <p className="text-sm text-destructive text-center">No payment gateway configured</p>
            ) : (
              <div className="space-y-2">
                {cardProvider && (
                  <Button
                    className="w-full gap-2"
                    disabled={!!pendingProvider}
                    onClick={() => handleBuy(cardProvider)}
                  >
                    {pendingProvider === cardProvider ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
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
                    {pendingProvider === "paypal" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    Pay with PayPal — ${total.toFixed(2)}
                  </Button>
                )}
              </div>
            )}
            <p className="text-center text-xs text-muted-foreground">
              Payments processed securely via Airwallex or PayPal
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default CertificateCreditsCard;
