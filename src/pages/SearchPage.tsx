import Navbar from "@/components/Navbar";
import CmsRenderer from "@/components/CmsRenderer";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Search, ScanLine, X, Camera, ArrowRight } from "lucide-react";
import PetCard from "@/components/PetCard";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useState, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import BarcodeScanner from "react-qr-barcode-scanner";

const SearchPage = () => {
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [showScanner, setShowScanner] = useState(false);
  const navigate = useNavigate();

  const { data: pets = [], isLoading } = useQuery({
    queryKey: ["search-pets", query],
    queryFn: async () => {
      if (!query.trim()) {
        const { data, error } = await supabase.from("pets_public" as any).select("*, pet_images(image_url, sort_order)").order("created_at", { ascending: false }).limit(50);
        if (error) throw error;
        return data as any[];
      }
      // Use secure global search RPC (covers name, species, breed, pet_code, microchip, UUID, owner name)
      const { data: matchIds } = await supabase.rpc("search_pets_global" as any, { _query: query });
      const ids = (matchIds || []).map((r: any) => r.id);
      if (ids.length === 0) return [];
      const { data: results } = await supabase.from("pets_public" as any)
        .select("*, pet_images(image_url, sort_order)")
        .in("id", ids)
        .order("created_at", { ascending: false });
      return results || [];
    },
  });

  const handleScanResult = useCallback((err: any, result: any) => {
    if (result) {
      const scannedText = result.getText();
      setShowScanner(false);
      const petIdMatch = scannedText.match(/\/pet\/([a-f0-9-]+)/i);
      if (petIdMatch) {
        toast.success("Pet found! Redirecting...");
        navigate(`/pet/${petIdMatch[1]}`);
      } else if (scannedText.match(/^[a-f0-9-]{36}$/i)) {
        toast.success("Pet found! Redirecting...");
        navigate(`/pet/${scannedText}`);
      } else {
        setQuery(scannedText);
        toast.info("QR code scanned — searching...");
      }
    }
  }, [navigate]);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <CmsRenderer slug="search" fallback={
      <main className="flex-1 py-10">
        <div className="container">
          {/* Header */}
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Find a Pet</h1>
            <p className="mt-2 text-muted-foreground">Search by pet name, ID, species — or scan a QR code</p>
          </div>

          {/* Search bar */}
          <div className="mx-auto mt-8 flex max-w-xl gap-3">
            <div className="flex flex-1 items-center overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <div className="flex flex-1 items-center gap-2 px-4">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search pets..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
            </div>
            <Button
              variant={showScanner ? "destructive" : "outline"}
              className="gap-2 rounded-xl"
              onClick={() => setShowScanner(!showScanner)}
            >
              {showScanner ? <><X className="h-4 w-4" /> Close</> : <><ScanLine className="h-4 w-4" /> Scan QR</>}
            </Button>
          </div>

          {showScanner && (
            <Card className="mx-auto mt-6 max-w-md overflow-hidden">
              <CardContent className="p-0">
                <div className="relative">
                  <div className="flex items-center gap-2 bg-primary/10 px-4 py-3">
                    <Camera className="h-5 w-5 text-primary" />
                    <span className="text-sm font-medium text-primary">Point your camera at the pet's QR code</span>
                  </div>
                  <div className="aspect-square w-full">
                    <BarcodeScanner width="100%" height="100%" onUpdate={handleScanResult} />
                  </div>
                  <div className="pointer-events-none absolute inset-0 top-[48px] flex items-center justify-center">
                    <div className="h-48 w-48 rounded-2xl border-4 border-primary/50" />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="mt-16 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {pets.map((pet) => {
                const firstImage = (pet.pet_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                return (
                  <PetCard key={pet.id} id={pet.id} name={pet.name} species={pet.species}
                    breed={pet.breed || ""} image={firstImage?.image_url || "/placeholder.svg"}
                    petCode={(pet as any).pet_code}
                    status={pet.status as "registered" | "lost" | "found"} />
                );
              })}
            </div>
          )}
          {!isLoading && pets.length === 0 && (
            <div className="mt-16 text-center">
              <p className="text-lg text-muted-foreground">No pets found matching your search.</p>
            </div>
          )}
        </div>
      </main>
      } />
      <Footer />
    </div>
  );
};

export default SearchPage;
