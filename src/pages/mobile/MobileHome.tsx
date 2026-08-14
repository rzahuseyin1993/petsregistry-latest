import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  PawPrint, Search, Heart, ShoppingCart, AlertTriangle,
  Sparkles, Building2, ArrowRight, Crown, Camera, MapPin, ShieldCheck, HeartHandshake
} from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useStoreEnabled } from "@/hooks/useStoreEnabled";
import { fetchBrowseAdoptions, fetchBrowseLostReports, fetchBrowsePets } from "@/lib/geoBrowseQueries";
import { useQuery } from "@tanstack/react-query";
import LostPetsBanner from "@/components/LostPetsBanner";

const quickActions = [
  { icon: Search, label: "Search", to: "/m/search", color: "bg-primary/10 text-primary" },
  { icon: Heart, label: "Adopt", to: "/m/adopt", color: "bg-rose-100 text-rose-600" },
  { icon: AlertTriangle, label: "Lost Pets", to: "/m/lost-pets", color: "bg-amber-100 text-amber-600" },
  { icon: HeartHandshake, label: "Report Lost/Found", to: "/m/report-lost", color: "bg-rose-100 text-rose-600" },
  { icon: Sparkles, label: "AI Expert", to: "/m/pet-expert", color: "bg-purple-100 text-purple-600" },
  { icon: ShoppingCart, label: "Store", to: "/m/store", color: "bg-emerald-100 text-emerald-600" },
  { icon: Building2, label: "Directory", to: "/m/directory", color: "bg-orange-100 text-orange-600" },
  { icon: Crown, label: "Plans", to: "/m/membership", color: "bg-yellow-100 text-yellow-600" },
  { icon: PawPrint, label: "Register", to: "/m/dashboard/register-pet", color: "bg-sky-100 text-sky-600" },
  { icon: ShieldCheck, label: "Verify", to: "/verify", color: "bg-teal-100 text-teal-600" },
];

const MobileHome = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();
  const { storeEnabled } = useStoreEnabled();

  const visibleQuickActions = quickActions.filter((action) => action.to !== "/m/store" || storeEnabled);

  const { data: recentPets = [] } = useQuery({
    queryKey: ["mobile-recent-pets", "worldwide"],
    queryFn: () => fetchBrowsePets(null, 6),
  });

  const { data: adoptPets = [] } = useQuery({
    queryKey: ["mobile-home-adopt", "worldwide"],
    queryFn: () => fetchBrowseAdoptions(null, 6),
  });

  const { data: lostPets = [] } = useQuery({
    queryKey: ["mobile-home-lost", "worldwide"],
    queryFn: () => fetchBrowseLostReports(null, 6),
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/m/search?q=${encodeURIComponent(searchQuery.trim())}`);
  };

  return (
    <div className="space-y-5 px-4 py-3">
      <LostPetsBanner />

      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 p-4"
      >
        <h1 className="font-display text-lg font-bold text-foreground">
          Welcome to PetsRegistry
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Register, protect & find your pets
        </p>
        <form onSubmit={handleSearch} className="mt-3 flex gap-2">
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search pet ID, name…"
            className="h-9 rounded-xl bg-background text-sm"
          />
          <Button
            type="button"
            size="icon"
            variant="outline"
            className="h-9 w-9 rounded-xl shrink-0"
            onClick={() => navigate("/m/scan")}
          >
            <Camera className="h-4 w-4" />
          </Button>
          <Button type="submit" size="icon" className="h-9 w-9 rounded-xl shrink-0">
            <Search className="h-4 w-4" />
          </Button>
        </form>
      </motion.div>

      {/* Quick Actions Grid */}
      <div>
        <h2 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</h2>
        <div className="grid grid-cols-3 gap-2">
          {visibleQuickActions.map((action, i) => {
            const Icon = action.icon;
            return (
              <Link key={action.to} to={action.to}>
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex flex-col items-center gap-1 rounded-xl py-2.5 transition-colors active:bg-muted"
                >
                  <div className={`rounded-lg p-2 ${action.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <span className="text-[10px] font-medium text-foreground leading-tight">{action.label}</span>
                </motion.div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recently Registered */}
      {recentPets.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground">Recently Registered</h2>
            <Link to="/m/search" className="flex items-center gap-1 text-[11px] font-medium text-primary">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {recentPets.map((pet: any) => {
              const img = pet.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
              return (
                <Link key={pet.id} to={`/m/pet/${pet.id}`} className="shrink-0 w-28">
                  <Card className="overflow-hidden border-border/60 shadow-sm">
                    <div className="aspect-[4/3] bg-muted">
                      <img
                        src={img?.image_url || "/placeholder.svg"}
                        alt={pet.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <CardContent className="p-1.5">
                      <p className="truncate text-xs font-semibold text-foreground">{pet.name}</p>
                      <p className="truncate text-[10px] text-muted-foreground">{pet.breed || pet.species}</p>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Adopt a Pet */}
      {adoptPets.length > 0 && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Heart className="h-3.5 w-3.5 text-rose-500" /> Adopt a Pet
            </h2>
            <Link to="/m/adopt" className="flex items-center gap-1 text-[11px] font-medium text-primary">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
            {adoptPets.map((a: any) => {
              const pet = a.pets;
              const img = pet?.pet_images?.sort((x: any, y: any) => x.sort_order - y.sort_order)[0];
              return (
                <Link key={a.id} to={`/m/pet/${pet?.id}`} className="shrink-0 w-28">
                  <Card className="overflow-hidden border-border/60 shadow-sm">
                    <div className="aspect-[4/3] bg-muted">
                      <img src={img?.image_url || "/placeholder.svg"} alt={pet?.name} className="h-full w-full object-cover" loading="lazy" />
                    </div>
                    <CardContent className="p-1.5">
                      <p className="truncate text-xs font-semibold text-foreground">{pet?.name}</p>
                      <div className="flex items-center justify-between">
                        <p className="truncate text-[10px] text-muted-foreground">{pet?.breed || pet?.species}</p>
                        {a.adoption_fee > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">${a.adoption_fee}</Badge>}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Lost Pets */}
      {lostPets.length > 0 && (
      <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-display text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" /> Lost Pets
            </h2>
            <Link to="/m/lost-pets" className="flex items-center gap-1 text-[11px] font-medium text-primary">
              See all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <Link to="/m/report-lost" className="mb-2 block">
            <Button size="sm" className="w-full gap-1.5 h-9 text-xs">
              <HeartHandshake className="h-3.5 w-3.5" /> Report a Lost or Found Pet
            </Button>
          </Link>
          <div className="space-y-2">
            {lostPets.map((r: any) => {
              const pet = r.pets;
              const img = pet?.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
              return (
                <Link key={r.id} to={`/m/pet/${pet?.id}`}>
                  <Card className="overflow-hidden border-border/60 shadow-sm">
                    <div className="flex">
                      <div className="h-16 w-16 shrink-0 bg-muted">
                        <img src={img?.image_url || "/placeholder.svg"} alt={pet?.name} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <CardContent className="flex-1 p-2 space-y-0.5">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-xs text-foreground">{pet?.name}</p>
                          <Badge variant="destructive" className="text-[8px] h-3.5 px-1">LOST</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{pet?.breed || pet?.species}</p>
                        {r.last_seen_address && (
                          <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5 shrink-0" /> <span className="truncate">{r.last_seen_address}</span>
                          </p>
                        )}
                      </CardContent>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default MobileHome;
