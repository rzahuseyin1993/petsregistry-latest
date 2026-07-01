import type { CertificateField, CertificateThemeColors } from "@/lib/certificateDesign";
import { buildThemeColors } from "@/lib/certificateDesign";

const BIRTH_THEME = {
  id: "pets-registry-birth-diploma-v1",
  name: "Pet Birth Certificate",
  description: "Formal diploma-style birth certificate",
  bgColor: "#FFFFFF",
  borderColor: "#1B2838",
  accentColor: "#C9A227",
  textColor: "#2D3748",
  headerColor: "#1B2838",
  fontFamily: "'Georgia', 'Times New Roman', serif",
  style: "classic" as const,
};

export function buildBirthCertificateFields(
  _colors: CertificateThemeColors,
  fontFamily: string,
): CertificateField[] {
  // Content rendered by BirthDiplomaContent; fields kept for template compatibility
  return [
    {
      id: "b1", type: "label", key: "title", label: "PET BIRTH CERTIFICATE",
      x: 50, y: 22, fontSize: 19, fontWeight: "700", color: BIRTH_THEME.headerColor,
      visible: true, fontFamily,
    },
  ];
}

export function buildBirthCertificateTemplate() {
  const colors = buildThemeColors(BIRTH_THEME);
  return {
    id: BIRTH_THEME.id,
    name: BIRTH_THEME.name,
    certificate_type: "birth" as const,
    background_url: null,
    is_active: true,
    colors,
    fontFamily: BIRTH_THEME.fontFamily,
    style: BIRTH_THEME.style,
    fields: buildBirthCertificateFields(colors, BIRTH_THEME.fontFamily),
  };
}
