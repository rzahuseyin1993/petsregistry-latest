import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Star, ChevronLeft, ChevronRight, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const MobileDirectory = () => {
  const [page, setPage] = useState(1);

  const { data: perPageSetting } = useQuery({
    queryKey: ["directory-per-page-setting"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "directory_per_page")
        .maybeSingle();
      return data?.value ? parseInt(data.value, 10) : 8;
    },
  });

  const perPage = perPageSetting || 8;

  const { data: listings = [], isLoading } = useQuery({
    queryKey: ["mobile-directory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("business_listings")
        .select("*")
        .eq("is_active", true)
        .eq("is_approved", true)
        .order("is_featured", { ascending: false })
        .order("is_paid", { ascending: false })
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const paidListings = listings.filter((l: any) => l.is_paid);
  const freeListings = listings.filter((l: any) => !l.is_paid);
  const sorted = [...paidListings, ...freeListings];

  const totalPages = Math.max(1, Math.ceil(sorted.length / perPage));
  const currentPage = Math.min(page, totalPages);
  const paginated = sorted.slice((currentPage - 1) * perPage, currentPage * perPage);

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="font-display text-lg font-bold text-foreground flex items-center gap-2">
          <Building2 className="h-5 w-5 text-orange-500" /> Business Directory
        </h1>
        <p className="text-xs text-muted-foreground mt-1">{sorted.length} listings</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginated.map((l: any) => (
              <Link key={l.id} to={`/m/directory/${l.id}`}>
                <Card className={l.is_featured ? "border-accent/50" : ""}>
                  <CardContent className="flex gap-3 p-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Building2 className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate font-semibold text-sm">{l.name}</p>
                        {l.is_featured && <Star className="h-3 w-3 shrink-0 text-accent fill-accent" />}
                      </div>
                      <div className="flex gap-1 mt-0.5">
                        {l.is_paid && <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 text-primary">Verified</Badge>}
                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">{l.category}</Badge>
                      </div>
                      {l.city && (
                        <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                          <MapPin className="h-2.5 w-2.5" /> {l.city}{l.country ? `, ${l.country}` : ""}
                        </p>
                      )}
                      {l.is_paid && l.whatsapp && (
                        <a href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          <Button variant="outline" size="sm" className="h-5 px-1.5 text-[9px] gap-1 mt-0.5 text-green-600 border-green-200">
                            <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground">
                {currentPage} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={currentPage >= totalPages} onClick={() => setPage(currentPage + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default MobileDirectory;
