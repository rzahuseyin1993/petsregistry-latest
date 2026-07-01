import type { CertificateTemplate } from "@/lib/certificateTemplates";

export type CertificateField = {
  id: string;
  type: "label" | "data";
  key: string;
  label: string;
  x: number;
  y: number;
  fontSize: number;
  fontWeight: string;
  color: string;
  visible: boolean;
  fontFamily?: string;
  letterSpacing?: string;
};

export type CertificateThemeColors = {
  bg: string;
  text: string;
  accent: string;
  border: string;
  panel?: string;
  isDark?: boolean;
};

function hexToRgb(hex: string) {
  const c = hex.replace("#", "");
  if (c.length < 6) return { r: 255, g: 255, b: 255 };
  return {
    r: parseInt(c.slice(0, 2), 16),
    g: parseInt(c.slice(2, 4), 16),
    b: parseInt(c.slice(4, 6), 16),
  };
}

export function isDarkBackground(hex: string): boolean {
  const { r, g, b } = hexToRgb(hex);
  return (r * 299 + g * 587 + b * 114) / 1000 < 140;
}

function mixHex(a: string, b: string, weight: number): string {
  const ar = hexToRgb(a);
  const br = hexToRgb(b);
  const r = Math.round(ar.r * (1 - weight) + br.r * weight);
  const g = Math.round(ar.g * (1 - weight) + br.g * weight);
  const bl = Math.round(ar.b * (1 - weight) + br.b * weight);
  return `#${[r, g, bl].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export function buildThemeColors(
  tpl: Pick<CertificateTemplate, "bgColor" | "borderColor" | "accentColor" | "textColor" | "headerColor">,
): CertificateThemeColors {
  const wasDark = isDarkBackground(tpl.bgColor);
  const bg = "#FFFFFF";
  const panel = mixHex(bg, tpl.borderColor, 0.07);
  const text = wasDark
    ? (isDarkBackground(tpl.headerColor) ? mixHex(tpl.borderColor, "#1a1a1a", 0.5) : tpl.headerColor)
    : tpl.textColor;

  return {
    bg,
    text: isDarkBackground(text) ? text : "#1E293B",
    accent: tpl.accentColor,
    border: tpl.borderColor,
    panel,
    isDark: false,
  };
}

/** Premium certificate layout — used for default + all built-in colour themes. */
export function buildPremiumCertificateFields(
  colors: CertificateThemeColors,
  fontFamily: string,
): CertificateField[] {
  const titleColor = colors.isDark ? colors.border : colors.text;
  const bodyColor = colors.text;
  const labelColor = colors.accent;
  const certNoColor = colors.border;

  const field = (
    id: string,
    type: "label" | "data",
    key: string,
    label: string,
    x: number,
    y: number,
    fontSize: number,
    fontWeight: string,
    color: string,
    extra?: Partial<CertificateField>,
  ): CertificateField => ({
    id,
    type,
    key,
    label,
    x,
    y,
    fontSize,
    fontWeight,
    color,
    visible: true,
    fontFamily,
    ...extra,
  });

  return [
    field("f1", "label", "title", "CERTIFICATE OF PET REGISTRATION", 50, 12.5, 26, "700", titleColor, { letterSpacing: "0.35cqw" }),
    field("f2", "label", "subtitle", "Official Registration Document", 50, 18, 11, "400", labelColor, { letterSpacing: "0.2cqw" }),
    field("f2b", "data", "certificate_number", "Certificate No. {{certificate_number}}", 50, 23, 14, "700", certNoColor, { letterSpacing: "0.12cqw" }),
    field("f3", "label", "pet_header", "PET DETAILS", 8, 30, 9, "700", labelColor, { letterSpacing: "0.28cqw" }),
    field("f4", "data", "pet_name", "Name · {{pet_name}}", 8, 35.5, 12.5, "600", bodyColor),
    field("f5", "data", "species", "Species · {{species}}", 8, 41, 11.5, "400", bodyColor),
    field("f6", "data", "breed", "Breed · {{breed}}", 8, 46, 11.5, "400", bodyColor),
    field("f7", "data", "color", "Color · {{color}}", 8, 51, 11.5, "400", bodyColor),
    field("f8", "data", "pet_code", "Pet ID · {{pet_code}}", 8, 56, 11.5, "500", bodyColor),
    field("f9", "data", "microchip", "Microchip · {{microchip}}", 8, 61, 11.5, "400", bodyColor),
    field("f10", "label", "owner_header", "OWNER", 52, 30, 9, "700", labelColor, { letterSpacing: "0.28cqw" }),
    field("f11", "data", "owner_name", "{{owner_name}}", 52, 35.5, 12.5, "600", bodyColor),
    field("f12", "data", "owner_email", "{{owner_email}}", 52, 41.5, 10.5, "400", bodyColor),
    field("f13", "data", "date_issued", "Issued {{date_issued}}", 52, 47, 10.5, "400", bodyColor),
    field("f14", "data", "pet_photo", "", 74, 32, 0, "400", bodyColor),
    field("f15", "label", "signature_line", "______________________________", 50, 81, 11, "400", bodyColor),
    field("f16", "label", "signature_label", "Authorized Signature · Pets Registry", 50, 86, 8.5, "500", labelColor, { letterSpacing: "0.18cqw" }),
    field("f17", "label", "footer", "VERIFIED OFFICIAL DOCUMENT · petsregistry.org", 50, 93, 7.5, "500", labelColor, { letterSpacing: "0.22cqw" }),
  ];
}

export function buildPremiumCertificateFromTheme(tpl: CertificateTemplate) {
  const colors = buildThemeColors(tpl);
  return {
    id: tpl.id,
    name: tpl.name,
    description: tpl.description,
    background_url: null,
    is_active: true,
    colors,
    fontFamily: tpl.fontFamily,
    style: tpl.style,
    fields: buildPremiumCertificateFields(colors, tpl.fontFamily),
  };
}

export const PREMIUM_DEFAULT_THEME: CertificateTemplate = {
  id: "__default_certificate_template__",
  name: "Pets Registry Official",
  description: "Premium white official certificate with company logo — recommended",
  bgColor: "#FFFFFF",
  borderColor: "#B8860B",
  accentColor: "#8B6914",
  textColor: "#2C2416",
  headerColor: "#1A1408",
  fontFamily: "'Georgia', 'Times New Roman', serif",
  style: "luxury",
};

export function buildDefaultCertificateTemplate() {
  return buildPremiumCertificateFromTheme(PREMIUM_DEFAULT_THEME);
}
