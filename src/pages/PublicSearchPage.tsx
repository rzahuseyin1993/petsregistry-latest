import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, AlertTriangle, Heart, MapPin } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ProtectedImage from "@/components/ProtectedImage";
import PetCard from "@/components/PetCard";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { fetchBrowseAdoptions, fetchBrowseLostReports, fetchBrowsePets, searchBrowsePets } from "@/lib/geoBrowseQueries";
import {
  getLostReportDetailLink,
  getLostReportImageUrl,
  getLostReportPetName,
  getLostReportSpeciesBreed,
} from "@/lib/lostReportDisplay";

const matches = (text: string | null | undefined, q: string) =>
  !q || (text || "").toLowerCase().includes(q.toLowerCase());

const matchesAny = (fields: (string | null | undefined)[], q: string) =>
  !q || fields.some((field) => matches(field, q));

const PublicSearchPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get("q") || "";
  const [query, setQuery] = useState(initialQuery);
  const [breedFilter, setBreedFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [tab, setTab] = useState<"all" | "lost" | "adopt">("all");
  const { visitorCountry, countryFilter } = useVisitorGeo();

  useEffect(() => {
    const next = query.trim();
    const current = searchParams.get("q") || "";
    if (next === current) return;
    if (next) setSearchParams({ q: next }, { replace: true });
    else setSearchParams({}, { replace: true });
  }, [query, searchParams, setSearchParams]);

  const trimmedQuery = query.trim();

  const { data: registeredPets = [], isLoading: petsLoading } = useQuery({
    queryKey: ["public-search-pets", trimmedQuery, countryFilter],
    queryFn: async () => {
      if (!trimmedQuery) return fetchBrowsePets(visitorCountry, 50);
      return searchBrowsePets(trimmedQuery, visitorCountry);
    },
  });

  const { data: lostReports = [] } = useQuery({
    queryKey: ["public-search-lost", countryFilter],
    queryFn: () => fetchBrowseLostReports(visitorCountry, 200),
  });

  const { data: adoptions = [] } = useQuery({
    queryKey: ["public-search-adoptions", countryFilter],
    queryFn: () => fetchBrowseAdoptions(visitorCountry, 200),
  });

  const breeds = useMemo(() => {
    const set = new Set<string>();
    lostReports.forEach((r: any) => {
      const breed = r.guest_pet_breed || r.pets?.breed;
      if (breed) set.add(breed);
    });
    adoptions.forEach((a: any) => a.pets?.breed && set.add(a.pets.breed));
    registeredPets.forEach((p: any) => p.breed && set.add(p.breed));
    return Array.from(set).sort();
  }, [lostReports, adoptions, registeredPets]);

  const filteredLost = lostReports.filter((r: any) => {
    const name = getLostReportPetName(r);
    const breed = r.guest_pet_breed || r.pets?.breed;
    const species = r.guest_pet_species || r.pets?.species;
    if (breedFilter && breed !== breedFilter) return false;
    if (locationFilter && !matches(r.last_seen_address, locationFilter)) return false;
    if (
      trimmedQuery &&
      !matchesAny([name, breed, species, r.pets?.pet_code, r.pets?.name, r.id], trimmedQuery)
    ) {
      return false;
    }
    return true;
  });

  const filteredAdoptions = adoptions.filter((a: any) => {
    const pet = a.pets;
    if (!pet) return false;
    if (breedFilter && pet.breed !== breedFilter) return false;
    if (
      trimmedQuery &&
      !matchesAny([pet.name, pet.breed, pet.species, pet.pet_code, pet.id], trimmedQuery)
    ) {
      return false;
    }
    return true;
  });

  const filteredRegistered = registeredPets.filter((pet: any) => {
    if (breedFilter && pet.breed !== breedFilter) return false;
    return true;
  });

  const showLost = tab === "all" || tab === "lost";
  const showAdopt = tab === "all" || tab === "adopt";
  const showRegisteredResults = tab === "all";
  const hasRegistered = showRegisteredResults && filteredRegistered.length > 0;
  const hasLost = showLost && filteredLost.length > 0;
  const hasAdopt = showAdopt && filteredAdoptions.length > 0;
  const hasAnyResults = hasRegistered || hasLost || hasAdopt;
  const isSearching = trimmedQuery.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navbar />
      <main className="flex-1 py-10">
        <div className="container">
          <div className="mx-auto max-w-2xl text-center">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">Public Pet Search</h1>
            <p className="mt-2 text-muted-foreground">
              Search by Pet ID, microchip, name, breed, or browse lost pets and adoptions.
            </p>
          </div>

          <div className="mx-auto mt-6 grid max-w-4xl gap-3 md:grid-cols-[1fr_220px_220px]">
            <div className="flex min-w-0 items-center gap-2 rounded-lg border border-border bg-card px-3 shadow-sm">
              <Search className="pointer-events-none h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <input
                type="text"
                className="min-w-0 flex-1 border-0 bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-sm"
                placeholder="Pet ID, microchip, name, breed..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                spellCheck={false}
                aria-label="Search pets by ID, microchip, name, or breed"
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

          {petsLoading && (
            <div className="mt-10 flex justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          )}

          {showRegisteredResults && hasRegistered && (
            <section className="mx-auto mt-8 max-w-6xl">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-foreground">
                <Search className="h-5 w-5 text-primary" /> Registered Pets
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {filteredRegistered.map((pet: any) => {
                  const firstImage = (pet.pet_images || []).sort((a: any, b: any) => a.sort_order - b.sort_order)[0];
                  return (
                    <PetCard
                      key={pet.id}
                      id={pet.id}
                      name={pet.name}
                      species={pet.species}
                      breed={pet.breed || ""}
                      image={firstImage?.image_url || "/placeholder.svg"}
                      petCode={pet.pet_code}
                      status={pet.status as "registered" | "lost" | "found"}
                    />
                  );
                })}
              </div>
            </section>
          )}

          {showLost && filteredLost.length > 0 && (
            <section className="mx-auto mt-8 max-w-6xl">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-destructive">
                <AlertTriangle className="h-5 w-5" /> Lost Pets
              </h2>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredLost.map((r: any) => {
                  const name = getLostReportPetName(r);
                  const detailLink = getLostReportDetailLink(r);
                  const mapsUrl =
                    r.last_seen_lat && r.last_seen_lng
                      ? `https://www.google.com/maps?q=${r.last_seen_lat},${r.last_seen_lng}`
                      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(r.last_seen_address || "")}`;

                  return (
                    <Card key={r.id} className="overflow-hidden transition hover:shadow-lg">
                      <Link to={detailLink} className="block">
                        <ProtectedImage src={getLostReportImageUrl(r)} alt={name} className="aspect-[4/3] w-full object-cover" />
                        <CardContent className="p-4 pb-2">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h3 className="font-semibold text-foreground">{name}</h3>
                              <p className="text-xs text-muted-foreground">{getLostReportSpeciesBreed(r)}</p>
                              {r.pets?.pet_code && (
                                <p className="mt-0.5 font-mono text-[10px] text-primary">{r.pets.pet_code}</p>
                              )}
                            </div>
                            <Badge variant="destructive" className="shrink-0">Lost</Badge>
                          </div>
                          {r.last_seen_address && (
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3 w-3 shrink-0" /> {r.last_seen_address}
                            </p>
                          )}
                        </CardContent>
                      </Link>
                      {r.last_seen_address && (
                        <CardContent className="px-4 pb-4 pt-0">
                          <a
                            href={mapsUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/5 px-2 py-0.5 text-[10px] font-medium text-primary hover:bg-primary/10"
                          >
                            <MapPin className="h-2.5 w-2.5" /> Open in Maps
                          </a>
                        </CardContent>
                      )}
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

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
                              {pet.pet_code && (
                                <p className="mt-0.5 font-mono text-[10px] text-primary">{pet.pet_code}</p>
                              )}
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

          {!petsLoading && !hasAnyResults && (
            <p className="mx-auto mt-10 max-w-md text-center text-muted-foreground">
              {isSearching
                ? "No pets match your search. Try the full Pet ID (e.g. PR-2026-100002) or microchip number."
                : "No pets found for your area yet. Try clearing filters or searching by Pet ID, microchip, or name."}
            </p>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default PublicSearchPage;
