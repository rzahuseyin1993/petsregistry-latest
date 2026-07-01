export type CertificateType = "ownership" | "birth";

export type CreditProductType =
  | "ownership"
  | "birth"
  | "bundle"
  | "ownership_pack_10"
  | "birth_pack_10"
  | "reseller_mixed_pack_10";

export const CERTIFICATE_TYPE_LABELS: Record<CertificateType, string> = {
  ownership: "Ownership Certificate",
  birth: "Birth Certificate",
};

export const CERTIFICATE_TYPE_DESCRIPTIONS: Record<CertificateType, string> = {
  ownership: "Official proof of registered ownership — like a passport for your pet",
  birth: "Official proof of date of birth and parentage — for puppies and breeders",
};

export const CREDIT_PRODUCT_LABELS: Record<CreditProductType, string> = {
  ownership: "Ownership Credit",
  birth: "Birth Credit",
  bundle: "Ownership + Birth Bundle",
  ownership_pack_10: "Ownership Pack (10 credits)",
  birth_pack_10: "Birth Pack (10 credits)",
  reseller_mixed_pack_10: "Reseller Mixed Pack (5+5)",
};

export const CREDIT_PRODUCT_PRICE_KEYS: Record<CreditProductType, string> = {
  ownership: "service_price_certificate_ownership",
  birth: "service_price_certificate_birth",
  bundle: "service_price_certificate_bundle",
  ownership_pack_10: "service_price_certificate_ownership_pack_10",
  birth_pack_10: "service_price_certificate_birth_pack_10",
  reseller_mixed_pack_10: "service_price_certificate_reseller_mixed_pack_10",
};

export const DEFAULT_CERTIFICATE_PRICES: Record<CreditProductType, number> = {
  ownership: 15,
  birth: 15,
  bundle: 30,
  ownership_pack_10: 120,
  birth_pack_10: 120,
  reseller_mixed_pack_10: 120,
};

export function creditProductQuantity(product: CreditProductType, qty = 1): { ownership: number; birth: number } {
  switch (product) {
    case "birth":
      return { ownership: 0, birth: qty };
    case "bundle":
      return { ownership: qty, birth: qty };
    case "ownership_pack_10":
      return { ownership: 10 * qty, birth: 0 };
    case "birth_pack_10":
      return { ownership: 0, birth: 10 * qty };
    case "reseller_mixed_pack_10":
      return { ownership: 5 * qty, birth: 5 * qty };
    default:
      return { ownership: qty, birth: 0 };
  }
}

export function getCreditsForType(
  credits: { ownership_credits?: number; birth_credits?: number; credits?: number } | null | undefined,
  type: CertificateType,
): number {
  if (!credits) return 0;
  if (type === "birth") return credits.birth_credits ?? 0;
  return credits.ownership_credits ?? credits.credits ?? 0;
}
