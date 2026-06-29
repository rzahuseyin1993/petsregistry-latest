import { supabase } from "@/integrations/supabase/client";
import { filterByOwnerCountry, getVisitorCountryFilter } from "@/lib/geoCountry";
import type { VisitorCountry } from "@/lib/geoCountry";
import { isIdentifierPetQuery, normalizePetSearchQuery } from "@/lib/petSearch";

export async function fetchBrowsePets(visitor: VisitorCountry | null, limit = 50) {
  const { data, error } = await supabase
    .from("pets_public" as any)
    .select("*, pet_images(image_url, sort_order)")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return filterByOwnerCountry((data || []) as { owner_country?: string | null }[], visitor);
}

export async function searchBrowsePets(query: string, visitor: VisitorCountry | null) {
  const normalized = normalizePetSearchQuery(query);
  if (!normalized) return [];

  const worldwide = isIdentifierPetQuery(normalized);
  const country = worldwide ? null : getVisitorCountryFilter(visitor);
  const { data: matchIds, error } = await supabase.rpc("search_pets_global" as any, {
    _query: normalized,
    _country: country,
  });
  if (error) throw error;
  const ids = (matchIds || []).map((r: { id: string }) => r.id);
  if (ids.length === 0) return [];
  const { data: results, error: fetchErr } = await supabase
    .from("pets_public" as any)
    .select("*, pet_images(image_url, sort_order)")
    .in("id", ids)
    .order("created_at", { ascending: false });
  if (fetchErr) throw fetchErr;
  if (worldwide) return (results || []) as { owner_country?: string | null }[];
  return filterByOwnerCountry((results || []) as { owner_country?: string | null }[], visitor);
}

export async function fetchBrowseLostReports(visitor: VisitorCountry | null, limit?: number) {
  let q = supabase
    .from("lost_reports_public" as any)
    .select("*, pets(id, name, species, breed, color, owner_id, pet_images(image_url, sort_order))")
    .order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return filterByOwnerCountry((data || []) as { owner_country?: string | null }[], visitor);
}

export async function fetchBrowseAdoptions(visitor: VisitorCountry | null, limit?: number) {
  let q = supabase
    .from("pet_adoptions_browse" as any)
    .select("*, pets(id, name, species, breed, age, color, pet_code, pet_images(image_url, sort_order))");
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw error;
  return filterByOwnerCountry((data || []) as { owner_country?: string | null }[], visitor);
}
