import type { CertificateType } from "@/lib/certificateTypes";

export type PetCertificateInput = {
  name?: string | null;
  species?: string | null;
  breed?: string | null;
  color?: string | null;
  pet_code?: string | null;
  microchip_number?: string | null;
  date_of_birth?: string | null;
  sex?: string | null;
  birth_location?: string | null;
  birth_weight?: string | null;
  birth_height?: string | null;
  eye_color?: string | null;
  breeder_name?: string | null;
  sire_name?: string | null;
  dam_name?: string | null;
  sire_photo_url?: string | null;
  dam_photo_url?: string | null;
  sire?: { name?: string | null } | null;
  dam?: { name?: string | null } | null;
};

function formatDateLong(value?: string | null): string {
  if (!value) return "";
  const d = new Date(value.includes("T") ? value : `${value}T12:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function formatParentNames(sire?: string | null, dam?: string | null): string {
  const s = sire?.trim();
  const d = dam?.trim();
  if (s && d) return `${s} & ${d}`;
  if (s) return s;
  if (d) return d;
  return "—";
}

function formatBirthBornLine(birthDate: string, location?: string | null): string {
  const loc = location?.trim();
  if (birthDate && loc && loc !== "—") return `was born on ${birthDate}, at ${loc}.`;
  if (birthDate) return `was born on ${birthDate}.`;
  return "";
}

/** Replace certificate template placeholders with pet / owner data. */
export function fillCertificateTemplate(
  template: string,
  data: Record<string, string>,
): string {
  let out = template;
  for (const [key, val] of Object.entries(data)) {
    out = out.replaceAll(`{{${key}}}`, val || "—");
  }
  return out;
}

export function buildCertificatePetData(input: {
  pet?: PetCertificateInput | null;
  profile?: { full_name?: string | null; email?: string | null } | null;
  cert?: {
    certificate_number?: string | null;
    created_at?: string | null;
    is_paid?: boolean | null;
    certificate_type?: CertificateType | string | null;
    issued_for_name?: string | null;
    issued_for_email?: string | null;
  };
}): Record<string, string> {
  const pet = input.pet || {};
  const petCode = pet.pet_code?.trim() || "";
  const certificateNumber = input.cert?.certificate_number?.trim() || petCode || "";
  const sireName = pet.sire?.name || pet.sire_name || "";
  const damName = pet.dam?.name || pet.dam_name || "";
  const birthDate = formatDateLong(pet.date_of_birth);

  const issuedFor = input.cert?.issued_for_name?.trim() || "";

  return {
    pet_name: pet.name || "",
    species: pet.species || "",
    breed: pet.breed || "",
    color: pet.color || "",
    fur_color: pet.color || "",
    pet_code: petCode,
    certificate_number: certificateNumber || "Pending issue",
    microchip: pet.microchip_number || "",
    owner_name: input.profile?.full_name || "",
    owner_email: input.profile?.email || "",
    issued_for_name: issuedFor,
    issued_for_email: input.cert?.issued_for_email || "",
    date_issued: input.cert?.created_at
      ? new Date(input.cert.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "",
    birth_date_full: birthDate,
    birth_day: pet.date_of_birth ? new Date(`${pet.date_of_birth}T12:00:00`).getDate().toString() : "",
    birth_month: pet.date_of_birth
      ? new Date(`${pet.date_of_birth}T12:00:00`).toLocaleDateString("en-US", { month: "long" })
      : "",
    birth_year: pet.date_of_birth
      ? new Date(`${pet.date_of_birth}T12:00:00`).getFullYear().toString()
      : "",
    birth_location: pet.birth_location || "—",
    birth_weight: pet.birth_weight || "—",
    birth_height: pet.birth_height || "—",
    sex: pet.sex || "—",
    eye_color: pet.eye_color || "—",
    breeder_name: pet.breeder_name || "—",
    sire_name: sireName || "—",
    dam_name: damName || "—",
    parent_names: formatParentNames(sireName, damName),
    birth_born_line: formatBirthBornLine(birthDate, pet.birth_location),
    registrar_name: pet.breeder_name?.trim() || "Pets Registry",
    sire_photo_url: pet.sire_photo_url || "",
    dam_photo_url: pet.dam_photo_url || "",
    certificate_type: input.cert?.certificate_type || "ownership",
  };
}

export const PET_CERTIFICATE_SELECT = `
  *,
  pets(
    name, species, breed, color, pet_code, microchip_number,
    date_of_birth, sex, birth_location, birth_weight, birth_height,
    eye_color, breeder_name, sire_name, dam_name, sire_photo_url, dam_photo_url,
    sire_pet_id, dam_pet_id,
    pet_images(image_url, sort_order),
    sire:sire_pet_id(name, pet_images(image_url, sort_order)),
    dam:dam_pet_id(name, pet_images(image_url, sort_order))
  )
`;
