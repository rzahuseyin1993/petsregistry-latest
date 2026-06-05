export type LostReportRow = {
  id: string;
  pet_id?: string | null;
  is_guest?: boolean | null;
  guest_pet_name?: string | null;
  guest_pet_species?: string | null;
  guest_pet_breed?: string | null;
  guest_pet_photo_url?: string | null;
  last_seen_date?: string | null;
  created_at?: string | null;
  pets?: {
    id?: string;
    name?: string;
    species?: string;
    breed?: string | null;
    pet_images?: { image_url: string; sort_order: number }[];
  } | null;
};

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
  if (!report.is_guest && report.pets?.id) return `/pet/${report.pets.id}`;
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
