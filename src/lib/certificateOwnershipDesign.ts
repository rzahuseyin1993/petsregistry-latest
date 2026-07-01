import type { CertificateField, CertificateThemeColors } from "@/lib/certificateDesign";
import { buildThemeColors } from "@/lib/certificateDesign";

const OWNERSHIP_THEME = {
  id: "pets-registry-ownership-diploma-v1",
  name: "Pet Ownership Certificate",
  description: "Formal diploma-style ownership certificate",
  bgColor: "#FFFFFF",
  borderColor: "#1B2838",
  accentColor: "#C9A227",
  textColor: "#2D3748",
  headerColor: "#1B2838",
  fontFamily: "'Georgia', 'Times New Roman', serif",
  style: "classic" as const,
};

export function buildOwnershipCertificateFields(
  _colors: CertificateThemeColors,
  fontFamily: string,
): CertificateField[] {
  return [
    {
      id: "o1", type: "label", key: "title", label: "PET OWNERSHIP CERTIFICATE",
      x: 50, y: 22, fontSize: 18, fontWeight: "700", color: OWNERSHIP_THEME.headerColor,
      visible: true, fontFamily,
    },
  ];
}

export function buildOwnershipCertificateTemplate() {
  const colors = buildThemeColors(OWNERSHIP_THEME);
  return {
    id: OWNERSHIP_THEME.id,
    name: OWNERSHIP_THEME.name,
    certificate_type: "ownership" as const,
    background_url: null,
    is_active: true,
    colors,
    fontFamily: OWNERSHIP_THEME.fontFamily,
    style: OWNERSHIP_THEME.style,
    fields: buildOwnershipCertificateFields(colors, OWNERSHIP_THEME.fontFamily),
  };
}
