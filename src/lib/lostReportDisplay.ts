export const FOUND_SIGHTING_TAG = "[FOUND PET SIGHTING]";

export type LostReportRow = {
  id: string;
  pet_id?: string | null;
  is_guest?: boolean | null;
  reporter_id?: string | null;
  guest_pet_name?: string | null;
  guest_pet_species?: string | null;
  guest_pet_breed?: string | null;
  guest_pet_photo_url?: string | null;
  last_seen_date?: string | null;
  created_at?: string | null;
  description?: string | null;
  status?: string | null;
  last_seen_address?: string | null;
  last_seen_lat?: number | null;
  last_seen_lng?: number | null;
  reward?: string | null;
  pets?: {
    id?: string;
    name?: string;
    species?: string;
    breed?: string | null;
    owner_id?: string | null;
    pet_images?: { image_url: string; sort_order: number }[];
  } | null;
};

export type LostReportTipContext = {
  id: string;
  isGuest?: boolean | null;
  reporterId?: string | null;
  guestPetName?: string | null;
};

export function isFoundSightingReport(report: { description?: string | null }): boolean {
  return typeof report.description === "string" && report.description.startsWith(FOUND_SIGHTING_TAG);
}

export function stripFoundSightingTag(description: string | null | undefined): string {
  if (!description) return "";
  return description.replace(FOUND_SIGHTING_TAG, "").trim();
}

export function getLostReportDescription(report: LostReportRow): string {
  return stripFoundSightingTag(report.description);
}

export function toLostReportTipContext(report: LostReportRow): LostReportTipContext {
  return {
    id: report.id,
    isGuest: report.is_guest,
    reporterId: report.reporter_id,
    guestPetName: report.guest_pet_name,
  };
}

export function getLostReportPetName(report: LostReportRow): string {
  if (report.guest_pet_name?.trim()) return report.guest_pet_name.trim();
  return report.pets?.name || "Unknown pet";
}

export function getLostReportImageUrl(report: LostReportRow): string {
  if (report.guest_pet_photo_url) return report.guest_pet_photo_url;
  const img = report.pets?.pet_images?.sort((a, b) => a.sort_order - b.sort_order)[0];
  return img?.image_url || "/placeholder.svg";
}

export function getLostReportSpeciesBreed(report: LostReportRow): string {
  const species = report.guest_pet_species || report.pets?.species || "Unknown";
  const breed = report.guest_pet_breed || report.pets?.breed;
  return breed ? `${species} • ${breed}` : species;
}

export function getLostReportDetailLink(report: LostReportRow): string {
  // Listing-style reports (guest or logged-in without a registered pet) open the lost-pets detail.
  if (report.is_guest || report.guest_pet_name?.trim()) return `/lost-pets?report=${report.id}`;
  if (report.pets?.id) return `/pet/${report.pets.id}`;
  return `/lost-pets?report=${report.id}`;
}

export function getLostReportDate(report: LostReportRow): Date {
  if (report.last_seen_date) return new Date(`${report.last_seen_date}T12:00:00`);
  if (report.created_at) return new Date(report.created_at);
  return new Date();
}

export function formatLostReportDate(report: LostReportRow): string {
  return getLostReportDate(report).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
