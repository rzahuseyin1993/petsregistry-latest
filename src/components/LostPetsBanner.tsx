import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { AlertTriangle, MapPin, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useMobilePath } from "@/hooks/useIsMobileRoute";

const LostPetsBanner = () => {
  const mp = useMobilePath();
  const { data: lostPets = [] } = useQuery({
    queryKey: ["lost-pets-banner"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lost_reports_public" as any)
        .select("*, pets(id, name, species, breed, pet_images(image_url, sort_order))")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000,
  });

  if (lostPets.length === 0) return null;

  return (
    <section className="border-b border-destructive/20 bg-destructive/5">
      <div className="container py-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive animate-pulse" />
          </div>
          <h3 className="font-display text-base font-bold text-destructive">
            {lostPets.length} Lost Pet{lostPets.length > 1 ? "s" : ""} — Help Reunite!
          </h3>
          <Link to={mp("/search?status=lost")} className="ml-auto">
            <Button variant="outline" size="sm" className="gap-1 border-destructive/30 text-destructive hover:bg-destructive/10">
              View All <ArrowRight className="h-3 w-3" />
            </Button>
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1">
          <AnimatePresence>
            {lostPets.map((report: any) => {
              const pet = report.pets;
              if (!pet) return null;
              const image = pet.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
              return (
                <motion.div
                  key={report.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex-shrink-0"
                >
                  <Link to={mp(`/pet/${pet.id}`)}>
                    <div className="flex items-center gap-3 rounded-xl border border-destructive/20 bg-card px-4 py-3 shadow-sm transition-shadow hover:shadow-md w-[280px] h-[76px]">
                      <img
                        src={image?.image_url || "/placeholder.svg"}
                        alt={pet.name}
                        className="h-12 w-12 shrink-0 rounded-lg object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-display font-semibold text-foreground truncate flex-1">{pet.name}</p>
                          <Badge className="bg-destructive text-destructive-foreground shrink-0 text-[9px] h-4 px-1.5">LOST</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{pet.species}{pet.breed ? ` • ${pet.breed}` : ""}</p>
                        {report.last_seen_address && (
                          <div className="mt-0.5 flex items-center gap-1 text-xs text-destructive">
                            <MapPin className="h-3 w-3 shrink-0" />
                            <span className="truncate">{report.last_seen_address}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
};

export default LostPetsBanner;
