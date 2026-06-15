import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/hooks/use-toast";
import { Heart, Coffee, Trophy, Star, Sparkles, HandHeart, Loader2, CreditCard } from "lucide-react";
import { motion } from "framer-motion";
import { completeCheckout } from "@/lib/airwallexCheckout";
import {
  filterVisiblePaymentProviders,
  getCardProvider,
  parseFunctionError,
  type PaymentProvider,
} from "@/lib/paymentProviders";

const packageIcons: Record<string, typeof Heart> = {
  Coffee: Coffee,
  Supporter: Heart,
  Champion: Trophy,
  Hero: Star,
};

const DonatePage = () => {
  const { user, profile } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [customAmount, setCustomAmount] = useState("");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [message, setMessage] = useState("");
  const [providerOpen, setProviderOpen] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<PaymentProvider | null>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ["donation-packages"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("donation_packages")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const { data: gateways = [] } = useQuery({
    queryKey: ["payment-gateways-public"],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_settings_safe")
        .select("provider, is_active")
        .eq("is_active", true);
      return filterVisiblePaymentProviders((data || []).map((g: any) => g.provider));
    },
  });

  const selectedPkg = packages.find((p: any) => p.id === selectedPackage);
  const finalAmount = selectedPkg ? Number(selectedPkg.amount) : Number(customAmount) || 0;

  const donateMutation = useMutation({
    mutationFn: async (provider: PaymentProvider) => {
      if (finalAmount <= 0) throw new Error("Please select or enter a donation amount");

      setPendingProvider(provider);

      const { data, error } = await supabase.functions.invoke("donation-checkout", {
        body: {
          amount: finalAmount,
          donorName: user ? profile?.full_name || "" : donorName,
          donorEmail: user ? user.email : donorEmail,
          userId: user?.id || null,
          packageId: selectedPackage,
          message,
          provider,
        },
      });

      if (error) throw new Error(await parseFunctionError(error));
      if (data?.error) throw new Error(data.error);
      if (data?.checkout || data?.url) {
        await completeCheckout(data);
      } else if (data?.success) {
        toast({ title: "Thank you! 🎉", description: "Your donation has been recorded." });
        setProviderOpen(false);
      }
    },
    onSettled: () => setPendingProvider(null),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cardProvider = getCardProvider(gateways);

  const handleDonateClick = () => {
    if (finalAmount <= 0) return;
    if (gateways.length === 0) {
      toast({ title: "Payments unavailable", description: "No payment gateway is configured.", variant: "destructive" });
      return;
    }
    if (gateways.length === 1) {
      donateMutation.mutate(gateways[0] as PaymentProvider);
    } else {
      setProviderOpen(true);
    }
  };

  const defaultContent = (
    <>

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/10 py-16">
        <div className="container text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <HandHeart className="mx-auto h-14 w-14 text-accent" />
            <h1 className="mt-4 font-display text-4xl font-bold text-foreground">Support PetsRegistry</h1>
            <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">
              Your generous donation helps us maintain this platform, support pet rescue operations,
              and reunite lost pets with their families. Every contribution makes a difference!
            </p>
          </motion.div>
        </div>
      </div>

      <div className="container max-w-3xl py-12">
        {/* What donations are for */}
        <Card className="mb-8 border-primary/20 bg-primary/5">
          <CardContent className="p-6">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Sparkles className="h-5 w-5 text-primary" />
              What Your Donation Supports
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              <li>🐾 <strong>Platform Maintenance</strong> — Keeping PetsRegistry running and free for pet owners</li>
              <li>🔍 <strong>Lost Pet Recovery</strong> — Funding search tools and alert systems for lost pets</li>
              <li>🏠 <strong>Shelter Support</strong> — Helping local shelters with food, medicine, and supplies</li>
              <li>💉 <strong>Vaccination Drives</strong> — Sponsoring free vaccination campaigns for stray animals</li>
              <li>📱 <strong>New Features</strong> — Building better tools for pet registration and health tracking</li>
            </ul>
          </CardContent>
        </Card>

        {/* Package selection */}
        <h2 className="mb-4 font-display text-xl font-bold text-foreground">Choose a Donation Amount</h2>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {packages.map((pkg: any) => {
              const Icon = packageIcons[pkg.name] || Heart;
              const isSelected = selectedPackage === pkg.id;
              return (
                <motion.div key={pkg.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                  <Card
                    className={`cursor-pointer transition-all ${
                      isSelected
                        ? "border-primary ring-2 ring-primary/30 bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                    onClick={() => {
                      setSelectedPackage(isSelected ? null : pkg.id);
                      setCustomAmount("");
                    }}
                  >
                    <CardContent className="flex items-center gap-4 p-5">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                      }`}>
                        <Icon className="h-6 w-6" />
                      </div>
                      <div className="flex-1">
                        <p className="font-display font-bold text-foreground">{pkg.name}</p>
                        <p className="text-sm text-muted-foreground">{pkg.description}</p>
                      </div>
                      <p className="text-2xl font-bold text-primary">${pkg.amount}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Custom amount */}
        <div className="mt-6">
          <Label className="text-sm font-medium text-foreground">Or enter a custom amount</Label>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-lg font-bold text-muted-foreground">$</span>
            <Input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={customAmount}
              onChange={(e) => {
                setCustomAmount(e.target.value);
                setSelectedPackage(null);
              }}
              className="max-w-[200px]"
            />
          </div>
        </div>

        {/* Donor info (for non-logged-in users) */}
        {!user && (
          <div className="mt-6 space-y-4">
            <h3 className="font-display font-semibold text-foreground">Your Details</h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Name (optional)</Label>
                <Input value={donorName} onChange={(e) => setDonorName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-2">
                <Label>Email (optional)</Label>
                <Input type="email" value={donorEmail} onChange={(e) => setDonorEmail(e.target.value)} placeholder="your@email.com" />
              </div>
            </div>
          </div>
        )}

        {/* Message */}
        <div className="mt-6 space-y-2">
          <Label>Leave a Message (optional)</Label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Tell us why you're donating or leave a kind word..."
            rows={3}
          />
        </div>

        {/* Submit */}
        <div className="mt-8">
          <Button
            size="lg"
            className="w-full gap-2 text-lg"
            disabled={finalAmount <= 0 || donateMutation.isPending}
            onClick={handleDonateClick}
          >
            <Heart className="h-5 w-5" />
            {donateMutation.isPending
              ? "Processing..."
              : finalAmount > 0
              ? `Donate $${finalAmount}`
              : "Select an amount to donate"}
          </Button>
          <p className="mt-2 text-center text-xs text-muted-foreground">
            Payments processed securely via Airwallex or PayPal
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <CmsRenderer slug="donate" fallback={defaultContent} />

      <Dialog open={providerOpen} onOpenChange={(o) => !donateMutation.isPending && setProviderOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Heart className="h-5 w-5 text-primary" /> Choose payment method
            </DialogTitle>
            <DialogDescription>
              Donating <span className="font-bold text-foreground">${finalAmount}</span> to PetsRegistry
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            {cardProvider && (
              <Button
                size="lg"
                className="w-full gap-2"
                disabled={!!pendingProvider}
                onClick={() => donateMutation.mutate(cardProvider)}
              >
                {pendingProvider === cardProvider ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-5 w-5" />}
                Pay with Card (Airwallex)
              </Button>
            )}
            {gateways.includes("paypal") && (
              <Button
                size="lg"
                variant="outline"
                className="w-full gap-2 bg-[#FFC439] hover:bg-[#F0B82E] text-black border-0"
                disabled={!!pendingProvider}
                onClick={() => donateMutation.mutate("paypal")}
              >
                {pendingProvider === "paypal" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Pay with PayPal
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Footer />
    </div>
  );
};

export default DonatePage;
