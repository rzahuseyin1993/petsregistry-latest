/** Replace certificate template placeholders with pet / owner data. */
export function fillCertificateTemplate(
  template: string,
  data: Record<string, string>,
): string {
  return template
    .replaceAll("{{pet_name}}", data.pet_name || "—")
    .replaceAll("{{species}}", data.species || "—")
    .replaceAll("{{breed}}", data.breed || "—")
    .replaceAll("{{color}}", data.color || "—")
    .replaceAll("{{pet_code}}", data.pet_code || data.certificate_number || "—")
    .replaceAll("{{certificate_number}}", data.certificate_number || data.pet_code || "—")
    .replaceAll("{{microchip}}", data.microchip || "—")
    .replaceAll("{{owner_name}}", data.owner_name || "—")
    .replaceAll("{{owner_email}}", data.owner_email || "—")
    .replaceAll("{{date_issued}}", data.date_issued || "—");
}

export function buildCertificatePetData(input: {
  pet?: {
    name?: string | null;
    species?: string | null;
    breed?: string | null;
    color?: string | null;
    pet_code?: string | null;
    microchip_number?: string | null;
  } | null;
  profile?: { full_name?: string | null; email?: string | null } | null;
  cert?: { certificate_number?: string | null; created_at?: string | null; is_paid?: boolean | null };
}): Record<string, string> {
  const pet = input.pet || {};
  const petCode = pet.pet_code?.trim() || "";
  const certificateNumber = input.cert?.certificate_number?.trim() || petCode || "";

  return {
    pet_name: pet.name || "",
    species: pet.species || "",
    breed: pet.breed || "",
    color: pet.color || "",
    pet_code: petCode,
    certificate_number: certificateNumber || "Pending issue",
    microchip: pet.microchip_number || "",
    owner_name: input.profile?.full_name || "",
    owner_email: input.profile?.email || "",
    date_issued: input.cert?.created_at
      ? new Date(input.cert.created_at).toLocaleDateString("en-US", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "",
  };
}
