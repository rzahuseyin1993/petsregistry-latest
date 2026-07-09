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
  ownership: "Certificate Credit",
  birth: "Certificate Credit",
  bundle: "2 Certificate Credits",
  ownership_pack_10: "Certificate Pack (10 credits)",
  birth_pack_10: "Certificate Pack (10 credits)",
  reseller_mixed_pack_10: "Reseller Pack (10 credits)",
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

/** Universal credits granted per product purchase (usable for ownership or birth). */
export function creditProductQuantity(product: CreditProductType, qty = 1): number {
  const packs = Math.max(1, qty);
  switch (product) {
    case "bundle":
      return packs * 2;
    case "ownership_pack_10":
    case "birth_pack_10":
    case "reseller_mixed_pack_10":
      return 10 * packs;
    default:
      return packs;
  }
}

export type CertificateCreditsRow = {
  credits?: number | null;
  ownership_credits?: number | null;
  birth_credits?: number | null;
};

/** Total universal credits (works for ownership or birth certificates). */
export function getUniversalCredits(
  credits: CertificateCreditsRow | null | undefined,
): number {
  if (!credits) return 0;
  if (credits.credits != null && credits.credits > 0) return credits.credits;
  return (credits.ownership_credits ?? 0) + (credits.birth_credits ?? 0);
}

/** @deprecated Use getUniversalCredits — credits are no longer typed per certificate. */
export function getCreditsForType(
  credits: CertificateCreditsRow | null | undefined,
  _type?: CertificateType,
): number {
  return getUniversalCredits(credits);
}
