import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Coins, Gift, ShoppingCart, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

const CertificateCreditsCard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [buyOpen, setBuyOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
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
    queryKey: ["payment-gateways"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_settings_safe" as any)
        .select("provider, is_active")
        .eq("is_active", true);
      return (data || []).map((g: any) => g.provider);
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

  const handleBuy = async (provider: "stripe" | "paypal") => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("certificate-checkout", {
        body: { user_id: user.id, quantity, provider },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

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

      <Dialog open={buyOpen} onOpenChange={setBuyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Gift className="h-5 w-5 text-primary" /> Buy Certificate Credits</DialogTitle>
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
            {gateways.length === 0 ? (
              <p className="text-sm text-destructive text-center">No payment gateway configured</p>
            ) : (
              <div className="grid gap-2" style={{ gridTemplateColumns: gateways.length > 1 ? "1fr 1fr" : "1fr" }}>
                {gateways.includes("stripe") && (
                  <Button onClick={() => handleBuy("stripe")} disabled={loading} className="gap-2">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "💳"} Pay with Card
                  </Button>
                )}
                {gateways.includes("paypal") && (
                  <Button onClick={() => handleBuy("paypal")} disabled={loading} variant="outline" className="gap-2 bg-[#FFC439] hover:bg-[#F0B82E] text-black border-0">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "PayPal"}
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
