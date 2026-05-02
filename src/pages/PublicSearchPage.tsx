import { useState, useMemo } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, Heart, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import ProtectedImage from "@/components/ProtectedImage";

const PublicSearchPage = () => {
  const [query, setQuery] = useState("");
  const [breedFilter, setBreedFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [tab, setTab] = useState<"all" | "lost" | "adopt">("all");

  const { data: lostReports = [] } = useQuery({
    queryKey: ["public-search-lost"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lost_reports_public" as any)
        .select("*, pets(id, name, species, breed, color, pet_images(image_url, sort_order))")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: adoptions = [] } = useQuery({
    queryKey: ["public-search-adoptions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pet_adoptions")
        .select("*, pets(id, name, species, breed, age, pet_images(image_url, sort_order))")
        .eq("status", "available")
        .eq("admin_approved", true)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
  });

  const breeds = useMemo(() => {
    const set = new Set<string>();
    lostReports.forEach((r: any) => r.pets?.breed && set.add(r.pets.breed));
    adoptions.forEach((a: any) => a.pets?.breed && set.add(a.pets.breed));
    return Array.from(set).sort();
  }, [lostReports, adoptions]);

  const matches = (text: string | null | undefined, q: string) =>
    !q || (text || "").toLowerCase().includes(q.toLowerCase());

  const filteredLost = lostReports.filter((r: any) => {
    const pet = r.pets;
    if (!pet) return false;
    if (breedFilter && pet.breed !== breedFilter) return false;
    if (locationFilter && !matches(r.last_seen_address, locationFilter)) return false;
    if (query && !(matches(pet.name, query) || matches(pet.breed, query) || matches(pet.species, query))) return false;
    return true;
  });

  const filteredAdoptions = adoptions.filter((a: any) => {
    const pet = a.pets;
    if (!pet) return false;
    if (breedFilter && pet.breed !== breedFilter) return false;
    if (query && !(matches(pet.name, query) || matches(pet.breed, query) || matches(pet.species, query))) return false;
    return true;
  });

  const showLost = tab === "all" || tab === "lost";
  const showAdopt = tab === "all" || tab === "adopt";

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Public Pet Search</h1>
            <p className="mt-2 text-muted-foreground">Browse lost pets and pets up for adoption — no login required.</p>
          </div>

          {/* Filters */}
          <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="flex items-center rounded-lg border border-border bg-card px-3 shadow-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input
                className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                placeholder="Search by name, species..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>
            <Select value={breedFilter || "all"} onValueChange={(v) => setBreedFilter(v === "all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All breeds" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All breeds</SelectItem>
                {breeds.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input placeholder="Location (city, area)" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} />
          </div>

          <div className="mx-auto mt-4 flex max-w-4xl gap-2">
            <Button variant={tab === "all" ? "default" : "outline"} size="sm" onClick={() => setTab("all")}>All</Button>
            <Button variant={tab === "lost" ? "default" : "outline"} size="sm" onClick={() => setTab("lost")}>
              <AlertTriangle className="mr-1 h-3 w-3" /> Lost ({filteredLost.length})
            </Button>
            <Button variant={tab === "adopt" ? "default" : "outline"} size="sm" onClick={() => setTab("adopt")}>
              <Heart className="mr-1 h-3 w-3" /> Adoption ({filteredAdoptions.length})
            </Button>
          </div>

          {/* Lost section */}
          {showLost && filteredLost.length > 0 && (
            <section className="mx-auto mt-8 max-w-6xl">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-destructive">
                <AlertTriangle className="h-5 w-5" /> Lost Pets
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLost.map((r: any) => {
                  const pet = r.pets;
                  const img = pet?.pet_images?.sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                  return (
                    <Link key={r.id} to={`/pet/${pet.id}`}>
                      <Card className="overflow-hidden transition hover:shadow-lg">
                        {img && <ProtectedImage src={img.image_url} alt={pet.name} className="aspect-[4/3] w-full object-cover" />}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{pet.name}</h3>
                              <p className="text-xs text-muted-foreground">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
                            </div>
                            <Badge variant="destructive" className="shrink-0">Lost</Badge>
                          </div>
                          {r.last_seen_address && (
                            <div className="mt-2 space-y-1">
                              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                <MapPin className="h-3 w-3" /> {r.last_seen_address}
                              </p>
                              <a
                                href={
                                  r.last_seen_lat && r.last_seen_lng
                                    ? `https://www.google.com/maps?q=${r.last_seen_lat},${r.last_seen_lng}`
                                    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.last_seen_address)}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                              >
                                <MapPin className="h-2.5 w-2.5" /> Open in Maps
                              </a>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {/* Adoption section */}
          {showAdopt && filteredAdoptions.length > 0 && (
            <section className="mx-auto mt-10 max-w-6xl">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-primary">
                <Heart className="h-5 w-5" /> Up for Adoption
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAdoptions.map((a: any) => {
                  const pet = a.pets;
                  const img = pet?.pet_images?.sort((x: any, y: any) => x.sort_order - y.sort_order)[0];
                  return (
                    <Link key={a.id} to={`/pet/${pet.id}`}>
                      <Card className="overflow-hidden transition hover:shadow-lg">
                        {img && <ProtectedImage src={img.image_url} alt={pet.name} className="aspect-[4/3] w-full object-cover" />}
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{pet.name}</h3>
                              <p className="text-xs text-muted-foreground">{pet.species}{pet.breed ? ` · ${pet.breed}` : ""}</p>
                            </div>
                            <Badge className="shrink-0">Adopt</Badge>
                          </div>
                          {a.adoption_fee > 0 && (
                            <p className="mt-2 text-xs text-muted-foreground">Fee: ${a.adoption_fee}</p>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          )}

          {(showLost || showAdopt) && filteredLost.length === 0 && filteredAdoptions.length === 0 && (
            <p className="mx-auto mt-10 max-w-md text-center text-muted-foreground">
              No pets match your filters. Try clearing them.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PublicSearchPage;
