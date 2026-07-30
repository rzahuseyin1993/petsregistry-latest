import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CmsRenderer from "@/components/CmsRenderer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link, useNavigate } from "react-router-dom";
import {
  PawPrint, Shield, QrCode, Search, Heart, ShoppingCart,
  AlertTriangle, Sparkles, BookOpen, Map, Activity,
  ArrowRight, ScanLine, X, Camera
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback, lazy, Suspense } from "react";
import { toast } from "sonner";
import PetCard from "@/components/PetCard";
import LostPetsBanner from "@/components/LostPetsBanner";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import { fetchBrowseAdoptions, fetchBrowsePets } from "@/lib/geoBrowseQueries";


const BarcodeScanner = lazy(() => import("react-qr-barcode-scanner"));


const features = [
  { icon: Heart, title: "Adopt a Pet", description: "Browse & adopt pets looking for a forever home. Owners can list pets and transfer ownership seamlessly.", color: "bg-rose-100 text-rose-600", to: "/adopt" },
  { icon: Activity, title: "Health Tracker", description: "Track weight, height, temperature & vaccinations. Get reminders when vaccines are due.", color: "bg-pink-100 text-pink-600", to: "/dashboard/health" },
  { icon: ShoppingCart, title: "Pet Store", description: "Shop from curated pet stores", color: "bg-emerald-100 text-emerald-600", to: "/store" },
  { icon: AlertTriangle, title: "Lost Pets", description: "Help reunite lost pets with QR code scanning", color: "bg-amber-100 text-amber-600", to: "/lost-pets" },
  { icon: Sparkles, title: "AI Pet Expert", description: "Ask AI anything about your pet's health, behavior & care", color: "bg-purple-100 text-purple-600", to: "/pet-expert" },
  { icon: BookOpen, title: "Directory", description: "Find vets, groomers & shelters", color: "bg-orange-100 text-orange-600", to: "/directory" },
  { icon: Map, title: "Pet Map", description: "Find pet-friendly parks, vets & shops near you", color: "bg-sky-100 text-sky-600", to: "/pet-map" },
];

const Index = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();
  const { storeEnabled } = useStoreEnabled();

  const visibleFeatures = features.filter((feature) => feature.to !== "/store" || storeEnabled);

  const handleScanResult = useCallback((err: any, result: any) => {
    if (result) {
      const scannedText = result.getText();
      setShowScanner(false);
      const petIdMatch = scannedText.match(/\/pet\/([a-f0-9-]+)/i);
      if (petIdMatch) {
        // The profile page verifies the pet actually exists, so don't claim "found" yet
        toast.success("QR code scanned — opening pet profile...");
        navigate(`/pet/${petIdMatch[1]}`);
      } else if (scannedText.match(/^[a-f0-9-]{36}$/i)) {
        toast.success("QR code scanned — opening pet profile...");
        navigate(`/pet/${scannedText}`);
      } else {
        setSearchQuery(scannedText);
        toast.info("QR code scanned — searching...");
      }
    }
  }, [navigate]);

  const { data: recentPets = [] } = useQuery({
    queryKey: ["recent-pets", "worldwide"],
    queryFn: () => fetchBrowsePets(null, 4),
  });

  const { data: adoptionPets = [] } = useQuery({
    queryKey: ["home-adoptions", "worldwide"],
    queryFn: () => fetchBrowseAdoptions(null, 4),
  });

  const { data: stats } = useQuery({
    queryKey: ["home-stats", "worldwide"],
    queryFn: async () => {
      const pets = await fetchBrowsePets(null, 500);
      return {
        pets: pets.length,
      };
    },
  });

  const handleSearch = () => {
    if (searchQuery.trim()) navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
    else navigate("/search");
  };

  const heroFallback = (
    <section className="relative overflow-hidden py-16 md:py-24">
      <div className="container">


        <div className="grid items-center gap-8 md:grid-cols-2">
          <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.6 }} className="min-w-0">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-success" />
              <span className="text-sm font-medium text-foreground">{stats?.pets || 0}+ Pets Protected Worldwide</span>
            </div>

            <h1 className="font-display text-4xl font-extrabold leading-tight tracking-tight text-foreground md:text-5xl lg:text-6xl">
              The Global<br />
              <span className="text-primary">Pet Registry</span>
            </h1>

            <p className="mt-5 max-w-lg text-lg text-muted-foreground">
              Register, protect, adopt, and reunite pets worldwide. Your pet's digital passport, lost alerts, and more — all in one place.
            </p>

            <div className="mt-8 flex max-w-lg gap-2">
              <div className="flex flex-1 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
                <div className="flex flex-1 items-center gap-2 px-4">
                  <Search className="h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search by Pet ID, name, microchip, or breed..."
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && handleSearch()}
                  />
                </div>
                <Button onClick={handleSearch} className="m-1.5 gap-2 rounded-lg">
                  Search <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
              <Button
                variant={showScanner ? "destructive" : "outline"}
                size="icon"
                className="h-auto min-w-[44px] rounded-xl"
                onClick={() => setShowScanner(!showScanner)}
                title="Scan QR Code"
              >
                {showScanner ? <X className="h-5 w-5" /> : <ScanLine className="h-5 w-5" />}
              </Button>
            </div>

            {showScanner && (
              <Card className="mt-4 max-w-lg overflow-hidden">
                <CardContent className="p-0">
                  <div className="relative">
                    <div className="flex items-center gap-2 bg-primary/10 px-4 py-3">
                      <Camera className="h-5 w-5 text-primary" />
                      <span className="text-sm font-medium text-primary">Point your camera at the pet's QR code</span>
                    </div>
                     <div className="aspect-square w-full max-h-[300px]">
                       <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" /></div>}>
                         <BarcodeScanner width="100%" height="100%" onUpdate={handleScanResult} />
                       </Suspense>
                     </div>
                    <div className="pointer-events-none absolute inset-0 top-[48px] flex items-center justify-center">
                      <div className="h-40 w-40 rounded-2xl border-4 border-primary/50" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Link to="/register">
                <Button className="gap-2 rounded-lg">
                  <Shield className="h-4 w-4" /> Register Free
                </Button>
              </Link>
              <Link to="/search">
                <Button variant="outline" className="gap-2 rounded-lg">
                  <Heart className="h-4 w-4" /> Adopt a Pet
                </Button>
              </Link>
              {storeEnabled && (
                <Link to="/store">
                  <Button variant="outline" className="gap-2 rounded-lg">
                    <ShoppingCart className="h-4 w-4" /> Pet Store
                  </Button>
                </Link>
              )}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="relative w-full min-w-0"
          >
            <div className="relative w-full overflow-hidden rounded-2xl shadow-xl">
              <img
                src="https://images.unsplash.com/photo-1552053831-71594a27632d?w=1200&h=900&fit=crop&fm=webp"
                alt="Registered Pet"
                className="aspect-[4/3] w-full object-cover md:aspect-[5/4] lg:min-h-[420px] lg:aspect-auto"
                width={1200}
                height={900}
                fetchPriority="high"
              />
              <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-card/95 px-3 py-2 shadow-lg backdrop-blur-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10">
                  <QrCode className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-bold font-mono text-foreground">PR-2026-100001</p>
                  <p className="text-xs text-muted-foreground">Verified Profile</p>
                </div>
              </div>
              <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-card/95 px-3 py-1.5 shadow-lg backdrop-blur-sm">
                <span className="h-2 w-2 animate-pulse rounded-full bg-success" />
                <span className="text-xs font-medium text-foreground">Live Registry</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );

  const bodyFallback = (
    <>
      <section className="border-t border-border bg-muted/30 py-16">
        <div className="container">
          <h2 className="text-center font-display text-3xl font-bold text-foreground">
            Everything Your Pet Needs
          </h2>
          <div className="mt-10 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3">
            {visibleFeatures.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                >
                  <Link to={feature.to}>
                    <Card className="group h-full border-border bg-card transition-all hover:-translate-y-0.5 hover:shadow-md">
                      <CardContent className="flex items-center gap-4 p-5">
                        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${feature.color}`}>
                          <Icon className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="font-display text-base font-semibold text-card-foreground">
                            {feature.title}
                          </h3>
                          <p className="mt-0.5 text-sm text-muted-foreground">{feature.description}</p>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      <LostPetsBanner />

      {/* Report Lost CTA — moved above Recently Registered */}
      <section className="pt-8">
        <div className="container">
          <Link to="/report-lost" className="block">
            <div className="flex items-center justify-between gap-4 rounded-2xl bg-destructive px-6 py-5 text-destructive-foreground shadow-lg transition hover:opacity-95 md:px-8 md:py-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-destructive-foreground/20">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-lg font-bold md:text-xl">Lost your pet?</p>
                  <p className="text-sm opacity-90">Report it now — no account required to start.</p>
                </div>
              </div>
              <Button size="lg" variant="secondary" className="shrink-0 font-bold">
                Report Lost Pet <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </Link>
        </div>
      </section>

      {recentPets.length > 0 && (
        <section className="border-t border-border bg-muted/30 py-16">
          <div className="container">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold text-foreground">Recently Registered</h2>
              <Link to="/search" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {recentPets.map((pet) => {
                const firstImage = (pet.pet_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                return (
                  <PetCard
                    key={pet.id}
                    id={pet.id}
                    name={pet.name}
                    species={pet.species}
                    breed={pet.breed || ""}
                    image={firstImage?.image_url || "/placeholder.svg"}
                    petCode={(pet as any).pet_code}
                    status={pet.status as "registered" | "lost" | "found"}
                  />
                );
              })}
            </div>
          </div>
        </section>
      )}

      {adoptionPets.length > 0 && (
        <section className="border-t border-border py-16">
          <div className="container">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
                  <Heart className="h-5 w-5 text-rose-600" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground">Pets Looking for a Home</h2>
              </div>
              <Link to="/adopt" className="flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                View All <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {adoptionPets.map((a: any) => {
                const pet = a.pets;
                const img = pet?.pet_images?.sort((x: any, y: any) => x.sort_order - y.sort_order)[0];
                return (
                  <Link key={a.id} to="/adopt">
                    <Card className="group overflow-hidden border-border transition-all hover:shadow-md hover:-translate-y-0.5">
                      <div className="relative aspect-[4/3] overflow-hidden">
                        <img
                          src={img?.image_url || "/placeholder.svg"}
                          alt={pet?.name}
                          className="h-full w-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                        />
                        <Badge className="absolute left-3 top-3 bg-rose-500 text-white">
                          <Heart className="mr-1 h-3 w-3" /> For Adoption
                        </Badge>
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-display text-base font-semibold text-foreground">{pet?.name}</h3>
                        <p className="text-sm text-muted-foreground">{pet?.species} • {pet?.breed || "Mixed"}</p>
                        {a.adoption_fee > 0 && (
                          <Badge variant="secondary" className="mt-2">${a.adoption_fee}</Badge>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <section className="bg-primary py-16">
        <div className="container text-center">
          <h2 className="font-display text-3xl font-bold text-primary-foreground">
            Protect Your Pet Today
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-primary-foreground/90">
            Registration is free. Get a QR code profile and help ensure your pet can always find its way home.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link to="/register">
              <Button size="lg" className="rounded-lg bg-accent text-accent-foreground hover:bg-accent/90">
                Get Started Free
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" className="rounded-lg bg-accent text-accent-foreground hover:bg-accent/90">
                Browse Pets
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1">
        <CmsRenderer slug="home-hero" fallback={heroFallback} />
        <CmsRenderer slug="home-body" fallback={bodyFallback} />
      </main>
      <Footer />
    </div>
  );
};

export default Index;
