import { useState, useCallback } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Search, Camera, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import BarcodeScanner from "react-qr-barcode-scanner";

const MobileSearch = () => {
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") || "");
  const [searchTerm, setSearchTerm] = useState(params.get("q") || "");
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

  const handleScanResult = useCallback((err: any, result: any) => {
    if (result) {
      const scannedText = result.getText();
      setShowScanner(false);
      const petIdMatch = scannedText.match(/\/pet\/([a-f0-9-]+)/i);
      if (petIdMatch) {
        toast.success("Pet found! Redirecting...");
        navigate(`/m/pet/${petIdMatch[1]}`);
      } else if (scannedText.match(/^[a-f0-9-]{36}$/i)) {
        toast.success("Pet found! Redirecting...");
        navigate(`/m/pet/${scannedText}`);
      } else {
        setQuery(scannedText);
        setSearchTerm(scannedText);
        toast.info("QR code scanned — searching...");
      }
    }
  }, [navigate]);

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["mobile-search", searchTerm],
    queryFn: async () => {
      if (!searchTerm.trim()) {
        const { data } = await supabase.from("pets_public" as any).select("*, pet_images(image_url, sort_order)").order("created_at", { ascending: false }).limit(50);
        return data || [];
      }
      const { data: matchIds } = await supabase.rpc("search_pets_global" as any, { _query: searchTerm });
      const ids = (matchIds || []).map((r: any) => r.id);
      if (ids.length === 0) return [];
      const { data: results } = await supabase.from("pets_public" as any)
        .select("*, pet_images(image_url, sort_order)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return results || [];
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchTerm(query);
  };

  return (
    <div className="p-4 space-y-4">
      {/* QR Scanner */}
      {showScanner && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-black">
          <div className="flex items-center justify-between p-4">
            <p className="text-sm font-medium text-white">Scan Pet QR Code</p>
            <Button variant="ghost" size="sm" onClick={() => setShowScanner(false)} className="text-white hover:bg-white/20">
              <X className="h-5 w-5" />
            </Button>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <BarcodeScanner
              width={300}
              height={300}
              onUpdate={handleScanResult}
            />
          </div>
          <p className="pb-8 text-center text-xs text-white/60">
            Point camera at a PetsRegistry QR code
          </p>
        </div>
      )}

      {/* Search + QR button */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID, breed…"
          className="h-10 rounded-xl text-sm"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-10 rounded-xl px-3 shrink-0"
          onClick={() => setShowScanner(true)}
        >
          <Camera className="h-4 w-4" />
        </Button>
        <Button type="submit" size="sm" className="h-10 rounded-xl px-3 shrink-0">
          <Search className="h-4 w-4" />
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">{pets.length} pets found</p>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {pets.map((pet: any) => {
            const img = pet.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
            return (
              <Link key={pet.id} to={`/m/pet/${pet.id}`}>
                <Card className="overflow-hidden">
                  <div className="aspect-square bg-muted">
                    <img src={img?.image_url || "/placeholder.svg"} alt={pet.name} className="h-full w-full object-cover" />
                  </div>
                  <CardContent className="p-2.5">
                    <p className="truncate text-sm font-semibold text-foreground">{pet.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{pet.breed || pet.species}</p>
                    <Badge variant={pet.status === "lost" ? "destructive" : "secondary"} className="mt-1 text-[10px]">
                      {pet.status}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MobileSearch;
