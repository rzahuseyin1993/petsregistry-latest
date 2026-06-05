import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Locate, MapPin, Search, Building2, Crown, ArrowRight, MessageCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import { filterByCountryField } from "@/lib/geoCountry";
import { geocodeCountry } from "@/lib/geo";

type PlaceCategory = "veterinary" | "pet_shop" | "park" | "shelter" | "grooming" | "directory" | "custom";

type Place = {
  id: string | number;
  lat: number;
  lon: number;
  name: string;
  category: PlaceCategory;
  address?: string;
  emoji?: string;
  color?: string;
  iconUrl?: string;
  isPaid?: boolean;
  listingId?: string;
};

type DirectoryListing = {
  id: string;
  name: string;
  category: string;
  city: string | null;
  country: string | null;
  lat: number;
  lng: number;
  logo_url: string | null;
  whatsapp: string | null;
  is_paid: boolean;
  is_featured: boolean;
  description: string | null;
};

type Coordinates = { lat: number; lon: number };

const OVERPASS_API = "https://overpass-api.de/api/interpreter";

const CATEGORY_META: Record<string, { emoji: string; color: string; label: string }> = {
  veterinary: { emoji: "🏥", color: "#ef4444", label: "Vets" },
  pet_shop: { emoji: "🛒", color: "#22c55e", label: "Pet Shops" },
  park: { emoji: "🌳", color: "#3b82f6", label: "Parks" },
  shelter: { emoji: "🏠", color: "#f59e0b", label: "Shelters" },
  grooming: { emoji: "✂️", color: "#a855f7", label: "Grooming" },
  directory: { emoji: "🏪", color: "#06b6d4", label: "Local Businesses" },
  custom: { emoji: "📍", color: "#ef4444", label: "Custom" },
};

// Standard pin (free / OSM)
const createCategoryIcon = (category: string, emoji?: string, color?: string, iconUrl?: string) => {
  const config = CATEGORY_META[category] || CATEGORY_META.custom;
  const finalColor = color || config.color;

  const inner = iconUrl
    ? `<img src="${iconUrl}" style="width:20px;height:20px;border-radius:50%;object-fit:cover;" />`
    : (emoji || config.emoji);

  return L.divIcon({
    className: "pet-map-marker",
    html: `<div style="background:${finalColor};width:32px;height:32px;border-radius:9999px;display:flex;align-items:center;justify-content:center;font-size:16px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.25);">${inner}</div>`,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
};

// Premium pin: business logo + name label on top
const createPaidBusinessIcon = (name: string, logoUrl?: string | null) => {
  const safeName = name.replace(/"/g, '&quot;').replace(/</g, "&lt;");
  const inner = logoUrl
    ? `<img src="${logoUrl}" style="width:32px;height:32px;border-radius:9999px;object-fit:cover;border:3px solid #f59e0b;box-shadow:0 2px 8px rgba(0,0,0,0.3);background:white;" />`
    : `<div style="width:32px;height:32px;border-radius:9999px;background:#f59e0b;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;font-size:16px;color:white;font-weight:700;">${(name[0] || "?").toUpperCase()}</div>`;

  return L.divIcon({
    className: "pet-map-paid-marker",
    html: `
      <div style="position:relative;display:flex;flex-direction:column;align-items:center;">
        <div style="background:#1f2937;color:#fff;font-size:11px;font-weight:600;padding:2px 8px;border-radius:6px;white-space:nowrap;margin-bottom:4px;box-shadow:0 2px 6px rgba(0,0,0,0.25);max-width:140px;overflow:hidden;text-overflow:ellipsis;">${safeName}</div>
        <div style="width:0;height:0;border-left:5px solid transparent;border-right:5px solid transparent;border-top:5px solid #1f2937;margin-top:-4px;margin-bottom:-1px;"></div>
        ${inner}
      </div>
    `,
    iconSize: [40, 64],
    iconAnchor: [20, 56],
    popupAnchor: [0, -56],
  });
};

async function fetchNearbyPetPlaces(lat: number, lon: number, radius = 5000): Promise<Place[]> {
  const query = `
    [out:json][timeout:15];
    (
      node["amenity"="veterinary"](around:${radius},${lat},${lon});
      node["shop"="pet"](around:${radius},${lat},${lon});
      node["leisure"="dog_park"](around:${radius},${lat},${lon});
      node["leisure"="park"](around:${radius},${lat},${lon});
      node["animal_shelter"="yes"](around:${radius},${lat},${lon});
      node["shop"="pet_grooming"](around:${radius},${lat},${lon});
    );
    out body 80;
  `;

  const response = await fetch(OVERPASS_API, {
    method: "POST",
    body: `data=${encodeURIComponent(query)}`,
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });

  if (!response.ok) throw new Error("Failed to fetch pet map data");
  const data = await response.json();

  return (data.elements || [])
    .filter((el: any) => el.tags?.name)
    .map((el: any) => {
      let category: PlaceCategory = "park";
      if (el.tags.amenity === "veterinary") category = "veterinary";
      else if (el.tags.shop === "pet") category = "pet_shop";
      else if (el.tags.shop === "pet_grooming") category = "grooming";
      else if (el.tags.animal_shelter === "yes") category = "shelter";

      return {
        id: el.id,
        lat: el.lat,
        lon: el.lon,
        name: el.tags.name,
        category,
        address: el.tags["addr:street"]
          ? `${el.tags["addr:housenumber"] || ""} ${el.tags["addr:street"]}`.trim()
          : undefined,
      } satisfies Place;
    });
}

async function fetchDirectoryListings(): Promise<DirectoryListing[]> {
  const { data } = await supabase
    .from("business_listings")
    .select("id, name, category, city, country, lat, lng, logo_url, whatsapp, is_paid, is_featured, description")
    .eq("is_active", true)
    .eq("is_approved", true)
    .not("lat", "is", null)
    .not("lng", "is", null);

  if (!data) return [];

  return data
    .filter((l: any) => l.lat != null && l.lng != null && !isNaN(Number(l.lat)) && !isNaN(Number(l.lng)))
    .map((l: any) => ({
      id: l.id,
      name: l.name,
      category: l.category,
      city: l.city,
      country: l.country,
      lat: Number(l.lat),
      lng: Number(l.lng),
      logo_url: l.logo_url,
      whatsapp: l.whatsapp,
      is_paid: !!l.is_paid,
      is_featured: !!l.is_featured,
      description: l.description,
    }));
}

async function fetchCustomPins(): Promise<Place[]> {
  const { data } = await supabase
    .from("map_custom_pins")
    .select("*")
    .eq("is_active", true);

  return (data || []).map((pin: any) => ({
    id: pin.id,
    lat: Number(pin.lat),
    lon: Number(pin.lng),
    name: pin.name,
    category: "custom" as PlaceCategory,
    address: pin.description || undefined,
    emoji: pin.emoji,
    color: pin.color,
    iconUrl: pin.icon_url || undefined,
  }));
}

async function fetchMapSettings(): Promise<Record<string, string>> {
  const { data } = await supabase
    .from("site_settings")
    .select("key, value")
    .like("key", "map_%");

  const map: Record<string, string> = {};
  (data || []).forEach((s: any) => { map[s.key] = s.value; });
  return map;
}

// Distance in km using haversine
const distanceKm = (a: Coordinates, b: { lat: number; lng: number }) => {
  const R = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lng - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const x = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * R * Math.asin(Math.sqrt(x));
};

const PetMap = () => {
  const { visitorCountry, countryFilter, countryLabel, isLoading: geoLoading } = useVisitorGeo();
  const mapElementRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markerLayerRef = useRef<L.LayerGroup | null>(null);
  const visitorCountryRef = useRef(visitorCountry);
  visitorCountryRef.current = visitorCountry;
  const lastLoadedFilterRef = useRef<string | null | undefined>(undefined);

  const [center, setCenter] = useState<Coordinates>({ lat: 1.3521, lon: 103.8198 });
  const [defaultZoom, setDefaultZoom] = useState(13);
  const [places, setPlaces] = useState<Place[]>([]);
  const [customPins, setCustomPins] = useState<Place[]>([]);
  const [directory, setDirectory] = useState<DirectoryListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [filter, setFilter] = useState<PlaceCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [enabledCategories, setEnabledCategories] = useState<Record<string, boolean>>({
    veterinary: true, pet_shop: true, park: true, shelter: true, grooming: true, directory: true,
  });

  // Build directory pins with paid flag
  const directoryPins: Place[] = useMemo(() => directory.map((l) => ({
    id: `dir-${l.id}`,
    lat: l.lat,
    lon: l.lng,
    name: l.name,
    category: "directory" as PlaceCategory,
    address: [l.city, l.country].filter(Boolean).join(", ") || undefined,
    iconUrl: l.logo_url || undefined,
    isPaid: l.is_paid,
    listingId: l.id,
  })), [directory]);

  const allPlaces = useMemo(() => [...places, ...customPins, ...directoryPins], [places, customPins, directoryPins]);

  const filteredPlaces = useMemo(() => {
    let result = allPlaces.filter((p) => {
      if (p.category === "custom") return true;
      return enabledCategories[p.category] !== false;
    });
    if (filter) result = result.filter((p) => p.category === filter);
    return result;
  }, [filter, allPlaces, enabledCategories]);

  // Sorted nearby directory listings: paid + featured first, then by distance
  const nearbyListings = useMemo(() => {
    return [...directory]
      .map((l) => ({ ...l, _distKm: distanceKm(center, { lat: l.lat, lng: l.lng }) }))
      .sort((a, b) => {
        if (a.is_paid !== b.is_paid) return a.is_paid ? -1 : 1;
        if (a.is_featured !== b.is_featured) return a.is_featured ? -1 : 1;
        return a._distKm - b._distKm;
      });
  }, [directory, center]);

  const categories = useMemo(() => {
    const cats: Array<{ key: PlaceCategory | null; label: string }> = [
      { key: null, label: "All" },
    ];
    if (enabledCategories.veterinary) cats.push({ key: "veterinary", label: "🏥 Vets" });
    if (enabledCategories.pet_shop) cats.push({ key: "pet_shop", label: "🛒 Shops" });
    if (enabledCategories.park) cats.push({ key: "park", label: "🌳 Parks" });
    if (enabledCategories.shelter) cats.push({ key: "shelter", label: "🏠 Shelters" });
    if (enabledCategories.grooming) cats.push({ key: "grooming", label: "✂️ Groom" });
    if (enabledCategories.directory) cats.push({ key: "directory", label: "🏪 Partners" });
    if (customPins.length > 0) cats.push({ key: "custom", label: "📍 Custom" });
    return cats;
  }, [enabledCategories, customPins.length]);

  const loadData = useCallback(async (nextCenter: Coordinates, applySettingsCenter = false) => {
    setLoading(true);
    try {
      const settings = await fetchMapSettings();

      const enabled: Record<string, boolean> = {
        veterinary: settings.map_show_vets !== "false",
        pet_shop: settings.map_show_pet_shops !== "false",
        park: settings.map_show_parks !== "false",
        shelter: settings.map_show_shelters !== "false",
        grooming: settings.map_show_grooming !== "false",
        directory: settings.map_show_directory !== "false",
      };
      setEnabledCategories(enabled);

      if (applySettingsCenter && settings.map_default_lat && settings.map_default_lng) {
        const settingsCenter = {
          lat: parseFloat(settings.map_default_lat),
          lon: parseFloat(settings.map_default_lng),
        };
        if (!isNaN(settingsCenter.lat) && !isNaN(settingsCenter.lon)) {
          nextCenter = settingsCenter;
          setCenter(settingsCenter);
        }
      }
      if (settings.map_default_zoom) {
        const z = parseInt(settings.map_default_zoom);
        if (!isNaN(z)) setDefaultZoom(z);
      }

      const [osmData, pins, dirListings] = await Promise.all([
        fetchNearbyPetPlaces(nextCenter.lat, nextCenter.lon),
        fetchCustomPins(),
        enabled.directory !== false ? fetchDirectoryListings() : Promise.resolve([]),
      ]);

      const filtered = osmData.filter((p) => enabled[p.category] !== false);
      setPlaces(filtered);
      setCustomPins(pins);
      setDirectory(filterByCountryField(dirListings, visitorCountryRef.current));
    } catch (error) {
      console.error("Failed to load pet places", error);
      setPlaces([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!mapElementRef.current || mapInstanceRef.current) return;

    const map = L.map(mapElementRef.current, {
      zoomControl: true,
      scrollWheelZoom: true,
    }).setView([center.lat, center.lon], defaultZoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    markerLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;

    return () => {
      markerLayerRef.current?.clearLayers();
      markerLayerRef.current = null;
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (geoLoading || lastLoadedFilterRef.current === countryFilter) return;
    let cancelled = false;

    const resolveInitialCenter = async () => {
      lastLoadedFilterRef.current = countryFilter;
      const tryDeviceLocation = (): Promise<Coordinates | null> =>
        new Promise((resolve) => {
          if (!("geolocation" in navigator)) return resolve(null);
          navigator.geolocation.getCurrentPosition(
            (position) => resolve({ lat: position.coords.latitude, lon: position.coords.longitude }),
            () => resolve(null),
            { timeout: 5000 },
          );
        });

      const deviceCenter = await tryDeviceLocation();
      if (cancelled) return;

      if (deviceCenter) {
        setCenter(deviceCenter);
        await loadData(deviceCenter);
        return;
      }

      const label = countryLabel || visitorCountry?.countryName || visitorCountry?.countryCode;
      if (label) {
        const coords = await geocodeCountry(label);
        if (cancelled) return;
        if (coords) {
          const countryCenter = { lat: coords.lat, lon: coords.lng };
          setCenter(countryCenter);
          await loadData(countryCenter);
          return;
        }
      }

      await loadData({ lat: 1.3521, lon: 103.8198 }, true);
    };

    void resolveInitialCenter();
    return () => { cancelled = true; };
  }, [geoLoading, countryFilter, countryLabel, visitorCountry, loadData]);

  useEffect(() => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([center.lat, center.lon], defaultZoom, { animate: true });
    // Invalidate size in case container changed
    setTimeout(() => mapInstanceRef.current?.invalidateSize(), 100);
  }, [center, defaultZoom]);

  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerLayer = markerLayerRef.current;
    if (!map || !markerLayer) return;

    markerLayer.clearLayers();

    filteredPlaces.forEach((place) => {
      const icon = place.category === "directory" && place.isPaid
        ? createPaidBusinessIcon(place.name, place.iconUrl)
        : createCategoryIcon(place.category, place.emoji, place.color, place.iconUrl);

      const marker = L.marker([place.lat, place.lon], { icon });

      const catLabel = CATEGORY_META[place.category]?.label || place.category;
      const profileLink = place.listingId
        ? `<a href="/directory/${place.listingId}" style="display:inline-block;margin-top:6px;font-size:12px;color:#0ea5e9;font-weight:600;text-decoration:none;">View profile →</a>`
        : "";
      marker.bindPopup(`
        <div style="min-width:160px; font-family: system-ui, sans-serif;">
          <p style="margin:0; font-weight:600; font-size:14px; color:#111827;">${place.name}${place.isPaid ? ' <span style="color:#f59e0b;">★</span>' : ""}</p>
          <p style="margin:4px 0 0; font-size:12px; color:#6b7280;">${catLabel}${place.isPaid ? " • Verified Partner" : ""}</p>
          ${place.address ? `<p style="margin:6px 0 0; font-size:12px; color:#111827;">${place.address}</p>` : ""}
          ${profileLink}
        </div>
      `);

      markerLayer.addLayer(marker);
    });

    if (filteredPlaces.length > 0) {
      const bounds = L.latLngBounds(filteredPlaces.map((p) => [p.lat, p.lon] as [number, number]));
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 14 });
    }
  }, [filteredPlaces]);

  const handleLocate = () => {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextCenter = { lat: position.coords.latitude, lon: position.coords.longitude };
        setCenter(nextCenter);
        void loadData(nextCenter);
        setLocating(false);
      },
      () => setLocating(false),
      { timeout: 5000 },
    );
  };

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(searchQuery)}&limit=1`);
      const results = await res.json();
      if (results.length > 0) {
        const nextCenter = { lat: parseFloat(results[0].lat), lon: parseFloat(results[0].lon) };
        setCenter(nextCenter);
        void loadData(nextCenter);
      }
    } catch {
      // silently fail
    } finally {
      setSearching(false);
    }
  };

  const focusListing = (l: DirectoryListing & { _distKm?: number }) => {
    setCenter({ lat: l.lat, lon: l.lng });
    setDefaultZoom(16);
    // Open popup if marker exists
    setTimeout(() => {
      const map = mapInstanceRef.current;
      if (!map) return;
      map.setView([l.lat, l.lng], 16, { animate: true });
    }, 50);
  };

  return (
    <section id="pet-map" className="border-t border-border py-8 sm:py-12">
      <div className="container">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="flex items-center gap-2 font-display text-xl sm:text-2xl font-bold text-foreground">
              <MapPin className="h-5 w-5 sm:h-6 sm:w-6 text-primary" /> Pet Map
            </h2>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              Discover pet-friendly places & verified partners
              {countryLabel ? ` in ${countryLabel}` : " near you"}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 self-start sm:self-auto" onClick={handleLocate} disabled={locating}>
            <Locate className="h-4 w-4" />
            {locating ? "Locating..." : "Use My Location"}
          </Button>
        </div>

        <form onSubmit={handleSearch} className="mt-3 flex gap-2">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search location (e.g. Kuala Lumpur, Tokyo, New York...)"
              className="pl-9"
            />
          </div>
          <Button type="submit" size="sm" disabled={searching || !searchQuery.trim()} className="gap-1.5">
            {searching ? "Searching..." : "Search"}
          </Button>
        </form>

        <div className="mt-3 flex flex-wrap gap-1.5 sm:gap-2">
          {categories.map((category) => (
            <Button
              key={category.label}
              variant={filter === category.key ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(category.key)}
              className="rounded-full text-[11px] sm:text-xs h-7 sm:h-8 px-2.5 sm:px-3"
            >
              {category.label}
            </Button>
          ))}
          {!loading && (
            <span className="ml-1 sm:ml-2 flex items-center text-[11px] sm:text-xs text-muted-foreground">
              {filteredPlaces.length} place{filteredPlaces.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* 60/40 split: map on the left, directory listings on the right */}
        <div className="mt-3 sm:mt-4 grid gap-3 lg:grid-cols-5">
          {/* Map column (60%) */}
          <div className="lg:col-span-3 overflow-hidden rounded-xl border border-border shadow-sm h-[320px] sm:h-[460px]">
            <div ref={mapElementRef} className="h-full w-full" />
          </div>

          {/* Directory sidebar (40%) */}
          <aside className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden h-[320px] sm:h-[460px] flex flex-col">
            <div className="px-3 py-2 border-b border-border flex items-center justify-between bg-muted/30 shrink-0">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Nearby Businesses</h3>
              </div>
              <Link to="/directory" className="text-[11px] text-primary hover:underline flex items-center gap-0.5">
                See all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-border">
              {loading ? (
                <p className="p-4 text-xs text-muted-foreground text-center">Loading…</p>
              ) : nearbyListings.length === 0 ? (
                <div className="p-4 text-center">
                  <Building2 className="mx-auto h-8 w-8 text-muted-foreground/30" />
                  <p className="mt-2 text-xs text-muted-foreground">No listed businesses nearby yet.</p>
                  <Link to="/directory">
                    <Button variant="outline" size="sm" className="mt-3 text-xs gap-1">
                      <Crown className="h-3 w-3 text-accent" /> List your business
                    </Button>
                  </Link>
                </div>
              ) : (
                <>
                  {nearbyListings.slice(0, 25).map((l) => (
                    <button
                      key={l.id}
                      onClick={() => focusListing(l)}
                      className={`w-full text-left p-2.5 hover:bg-muted/50 transition-colors flex gap-2.5 ${
                        l.is_paid ? "bg-accent/5" : ""
                      }`}
                    >
                      <div className="h-10 w-10 shrink-0 rounded-lg overflow-hidden bg-primary/10 flex items-center justify-center">
                        {l.logo_url ? (
                          <img src={l.logo_url} alt={l.name} className="h-full w-full object-cover" />
                        ) : (
                          <Building2 className="h-4 w-4 text-primary" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <p className="truncate text-sm font-semibold text-foreground">{l.name}</p>
                          {l.is_featured && <Star className="h-3 w-3 shrink-0 text-accent fill-accent" />}
                        </div>
                        <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                          {l.is_paid && (
                            <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 text-primary">
                              <Crown className="h-2.5 w-2.5 mr-0.5" /> Verified
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
                            {l.category.replace("_", " ")}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {l._distKm < 1 ? `${Math.round(l._distKm * 1000)} m` : `${l._distKm.toFixed(1)} km`}
                          </span>
                        </div>
                        {l.city && (
                          <p className="text-[10px] text-muted-foreground truncate mt-0.5 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" /> {l.city}{l.country ? `, ${l.country}` : ""}
                          </p>
                        )}
                        {l.is_paid && (
                          <div className="flex items-center gap-1 mt-1" onClick={(e) => e.stopPropagation()}>
                            {l.whatsapp && (
                              <a
                                href={`https://wa.me/${l.whatsapp.replace(/\D/g, "")}`}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Button variant="outline" size="sm" className="h-5 px-1.5 text-[9px] gap-0.5 text-green-600 border-green-200">
                                  <MessageCircle className="h-2.5 w-2.5" /> WhatsApp
                                </Button>
                              </a>
                            )}
                            <Link to={`/directory/${l.id}`}>
                              <Button variant="ghost" size="sm" className="h-5 px-1.5 text-[9px] text-primary">
                                Profile →
                              </Button>
                            </Link>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}

                  {/* Promotion footer */}
                  <div className="p-3 bg-gradient-to-br from-accent/10 to-primary/10 border-t border-border">
                    <p className="text-[11px] font-semibold text-foreground flex items-center gap-1">
                      <Crown className="h-3 w-3 text-accent" /> Be seen on the map
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Verified Partners get a logo pin + name label and appear at the top.
                    </p>
                    <Link to="/directory">
                      <Button size="sm" className="mt-2 w-full h-7 text-[11px] gap-1">
                        Upgrade to Verified Partner <ArrowRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};

export default PetMap;
