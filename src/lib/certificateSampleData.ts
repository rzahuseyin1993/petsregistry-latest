import { buildCertificatePetData } from "@/lib/certificateData";
import type { CertificateType } from "@/lib/certificateTypes";

const SAMPLE_ISSUED = "2026-03-15T12:00:00Z";

const SAMPLE_OWNERSHIP_PET = {
  name: "Buddy",
  species: "dog",
  breed: "Golden Retriever",
  color: "Golden",
  pet_code: "PR-SAMPLE-001",
  microchip_number: "985112004567890",
  date_of_birth: "2024-06-12",
  sex: "Male",
};

const SAMPLE_BIRTH_PET = {
  name: "Luna",
  species: "cat",
  breed: "British Shorthair",
  color: "Blue",
  pet_code: "PR-SAMPLE-002",
  date_of_birth: "2025-11-08",
  sex: "Female",
  birth_location: "Austin, Texas, USA",
  birth_weight: "120 g",
  birth_height: "10 cm",
  eye_color: "Blue",
  breeder_name: "Sample Breeder",
  sire_name: "Thunderbolt",
  dam_name: "Whiskers",
};

export function getSampleCertificatePetData(type: CertificateType): Record<string, string> {
  if (type === "birth") {
    return buildCertificatePetData({
      pet: SAMPLE_BIRTH_PET,
      profile: { full_name: "Sample Breeder" },
      cert: {
        certificate_number: "PR-2026-SAMPLE-BIRTH",
        certificate_type: "birth",
        created_at: SAMPLE_ISSUED,
        is_paid: true,
      },
    });
  }

  return buildCertificatePetData({
    pet: SAMPLE_OWNERSHIP_PET,
    profile: { full_name: "Alex Morgan" },
    cert: {
      certificate_number: "PR-2026-SAMPLE-OWN",
      certificate_type: "ownership",
      created_at: SAMPLE_ISSUED,
      is_paid: true,
      issued_for_name: "Alex Morgan",
    },
  });
}
