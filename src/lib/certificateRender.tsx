import type { CSSProperties, ReactNode } from "react";
import logo from "@/assets/logo.png";
import { fillCertificateTemplate } from "@/lib/certificateData";
import { buildBirthCertificateTemplate } from "@/lib/certificateBirthDesign";
import { DiplomaCertificateDecor, renderDiplomaContent } from "@/lib/certificateDiplomaLayout";
import {
  buildDefaultCertificateTemplate,
  buildPremiumCertificateFields,
  buildThemeColors,
  type CertificateThemeColors,
} from "@/lib/certificateDesign";
import { buildOwnershipCertificateTemplate } from "@/lib/certificateOwnershipDesign";
import type { CertificateType } from "@/lib/certificateTypes";

const CANVAS_W = 594;
const CANVAS_H = 420;

export const DEFAULT_OWNERSHIP_TEMPLATE = buildOwnershipCertificateTemplate();
export const DEFAULT_BIRTH_TEMPLATE = buildBirthCertificateTemplate();
/** @deprecated use DEFAULT_OWNERSHIP_TEMPLATE */
export const DEFAULT_CERTIFICATE_TEMPLATE = buildDefaultCertificateTemplate();

export function getDefaultTemplateForType(type: CertificateType = "ownership") {
  return type === "birth" ? DEFAULT_BIRTH_TEMPLATE : DEFAULT_OWNERSHIP_TEMPLATE;
}

function CertificateDecor({
  colors,
  fontFamily,
  variant = "ownership",
}: {
  colors: CertificateThemeColors;
  fontFamily: string;
  variant?: CertificateType;
}) {
  const { bg, border, accent, panel, isDark } = colors;
  const glow = isDark ? `${border}33` : `${border}18`;
  const innerLine = isDark ? `${border}88` : `${border}66`;
  const goldLine = `${accent}88`;
  const decorZ = 0;

  const panelTop = variant === "birth" ? "54%" : "28%";
  const panelHeight = variant === "birth" ? "30%" : "36%";

  return (
    <>
      {/* Paper texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: decorZ,
          background: `
            radial-gradient(ellipse 120% 80% at 50% 0%, #ffffff 0%, ${bg} 50%),
            linear-gradient(180deg, ${panel}40 0%, transparent 12%, transparent 88%, ${panel}30 100%)
          `,
          pointerEvents: "none",
        }}
      />

      {/* Company logo */}
      <img
        src={logo}
        alt="Pets Registry"
        style={{
          position: "absolute",
          left: "50%",
          top: "1%",
          transform: "translateX(-50%)",
          height: "8.5cqw",
          width: "auto",
          maxWidth: "38%",
          objectFit: "contain",
          zIndex: decorZ + 1,
          pointerEvents: "none",
          mixBlendMode: "lighten",
        }}
      />

      {/* Subtle watermark */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: "50%",
          top: "58%",
          transform: "translate(-50%, -50%)",
          fontSize: "24cqw",
          opacity: 0.03,
          color: border,
          pointerEvents: "none",
          userSelect: "none",
          lineHeight: 1,
          zIndex: decorZ,
        }}
      >
        🐾
      </div>

      {/* Outer gold frame */}
      <div
        style={{
          position: "absolute",
          inset: "1.5%",
          border: `2px solid ${border}`,
          borderRadius: "4px",
          pointerEvents: "none",
          zIndex: decorZ,
          boxShadow: `inset 0 0 0 1px ${goldLine}`,
        }}
      />
      {/* Inner frame */}
      <div
        style={{
          position: "absolute",
          inset: "2.6%",
          border: `1px solid ${innerLine}`,
          borderRadius: "2px",
          pointerEvents: "none",
          zIndex: decorZ,
        }}
      />

      {/* Corner ornaments */}
      {[
        { top: "2.8%", left: "2.8%", borderTop: true, borderLeft: true },
        { top: "2.8%", right: "2.8%", borderTop: true, borderRight: true },
        { bottom: "2.8%", left: "2.8%", borderBottom: true, borderLeft: true },
        { bottom: "2.8%", right: "2.8%", borderBottom: true, borderRight: true },
      ].map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: "4.5cqw",
            height: "4.5cqw",
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            borderTop: c.borderTop ? `2px solid ${accent}` : undefined,
            borderLeft: c.borderLeft ? `2px solid ${accent}` : undefined,
            borderRight: c.borderRight ? `2px solid ${accent}` : undefined,
            borderBottom: c.borderBottom ? `2px solid ${accent}` : undefined,
            pointerEvents: "none",
            zIndex: decorZ,
          }}
        />
      ))}

      {/* Header rule */}
      <div
        style={{
          position: "absolute",
          left: "15%",
          right: "15%",
          top: variant === "birth" ? "25%" : "26%",
          height: "1px",
          background: `linear-gradient(90deg, transparent 0%, ${accent} 20%, ${border} 50%, ${accent} 80%, transparent 100%)`,
          pointerEvents: "none",
          zIndex: decorZ,
        }}
      />

      {/* Content panels */}
      <div
        style={{
          position: "absolute",
          left: "5%",
          top: panelTop,
          width: "44%",
          height: panelHeight,
          borderRadius: "6px",
          background: `linear-gradient(135deg, ${panel}ee 0%, #fffffff5 100%)`,
          border: `1px solid ${innerLine}`,
          boxShadow: `0 1px 8px ${glow}`,
          pointerEvents: "none",
          zIndex: decorZ,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50.5%",
          top: panelTop,
          width: "44.5%",
          height: panelHeight,
          borderRadius: "6px",
          background: `linear-gradient(135deg, ${panel}ee 0%, #fffffff5 100%)`,
          border: `1px solid ${innerLine}`,
          boxShadow: `0 1px 8px ${glow}`,
          pointerEvents: "none",
          zIndex: decorZ,
        }}
      />

      {/* Footer rule */}
      <div
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          top: "83.5%",
          height: "1px",
          background: `linear-gradient(90deg, transparent, ${innerLine}, transparent)`,
          pointerEvents: "none",
          zIndex: decorZ,
        }}
      />

      {/* Verified seal — bottom-right, clear of signature block */}
      <div
        style={{
          position: "absolute",
          right: "5%",
          bottom: "7%",
          left: "auto",
          width: "7.5cqw",
          height: "7.5cqw",
          borderRadius: "50%",
          border: `2px solid ${accent}`,
          outline: `1px solid ${border}`,
          outlineOffset: "2px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #ffffff 0%, #faf8f5 100%)",
          boxShadow: `0 2px 10px ${glow}`,
          pointerEvents: "none",
          fontFamily,
          zIndex: decorZ + 1,
        }}
      >
        <span style={{ fontSize: "1.9cqw", fontWeight: 700, color: border, letterSpacing: "0.08em" }}>VERIFIED</span>
        <span style={{ fontSize: "2.8cqw", lineHeight: 1, marginTop: "0.2cqw" }}>🐾</span>
      </div>
    </>
  );
}

function PetPhotoBox({
  imageUrl,
  borderColor,
  accentColor,
  isDark,
  style,
  placeholder = "Add photo in Edit Pet",
  caption,
  softFrame = false,
}: {
  imageUrl?: string;
  borderColor: string;
  accentColor: string;
  isDark?: boolean;
  style: CSSProperties;
  placeholder?: string;
  caption?: string;
  softFrame?: boolean;
}) {
  const { borderRadius, ...boxStyle } = style;
  return (
    <div style={{ ...boxStyle, padding: softFrame ? 0 : "0.3cqw", zIndex: boxStyle.zIndex ?? 3 }}>
      {caption && (
        <div style={{
          fontSize: "1.4cqw",
          fontWeight: 600,
          color: accentColor,
          textAlign: "center",
          marginBottom: "0.25cqw",
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}>
          {caption}
        </div>
      )}
      <div
        style={{
          width: "100%",
          height: caption ? "calc(100% - 2.2cqw)" : "100%",
          borderRadius: borderRadius || "8px",
          padding: softFrame ? 0 : "0.3cqw",
          background: softFrame ? "transparent" : `linear-gradient(135deg, ${borderColor}, ${accentColor})`,
          boxShadow: softFrame
            ? "0 4px 14px rgba(27,58,107,0.15)"
            : isDark ? "0 3px 16px rgba(0,0,0,0.35)" : "0 3px 12px rgba(0,0,0,0.1)",
        }}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt="Pet"
            crossOrigin="anonymous"
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: borderRadius || "9px",
              display: "block",
              background: "#fff",
              border: softFrame ? `2px solid ${borderColor}` : undefined,
            }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: "9px",
              background: isDark ? "#1a1a1a" : "#fafafa",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "1.1cqw",
              color: isDark ? "#888" : "#999",
              textAlign: "center",
              padding: "6px",
              gap: "0.5cqw",
            }}
          >
            <span style={{ fontSize: "3cqw" }}>🐾</span>
            <span>{placeholder}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function getCertificatePetImageUrl(cert: {
  pet_id?: string;
  pets?: { pet_images?: { image_url: string; sort_order: number }[] } | null;
}): string | undefined {
  const images = cert.pets?.pet_images || [];
  const sorted = [...images].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  return sorted[0]?.image_url;
}

export function isCanvasCertificateTemplate(template: any): boolean {
  const fields = (template?.fields as any[]) || [];
  return fields.length > 0 && fields[0]?.width != null && fields[0]?.type != null;
}

function isPhotoPlaceholder(content?: string | null): boolean {
  return /pet photo|📷|no photo/i.test(content || "");
}

const CENTERED_KEYS = new Set([
  "title", "subtitle", "certificate_number", "certify", "pet_name", "birth_date_full", "birth_location",
  "birth_born_line", "breed_stat", "fur_stat", "eye_stat", "weight_stat", "sex_stat",
  "legal", "footer", "signature_line", "signature_label",
]);

const WRAP_KEYS = new Set(["legal", "birth_born_line", "footer", "owner_email", "signature_line"]);

const HEADER_KEYS = new Set([
  "parents_header", "details_header", "owner_header", "pet_header",
]);

function renderFieldCertificate(
  template: any,
  petData: Record<string, string>,
  petImageUrl?: string,
  parentPhotos?: { sire?: string; dam?: string },
  showPetPhoto?: boolean,
) {
  const colors: CertificateThemeColors = (template.colors as CertificateThemeColors) || buildThemeColors({
    bgColor: template.colors?.bg || "#FFFFFF",
    borderColor: template.colors?.border || "#1B2838",
    accentColor: template.colors?.accent || "#C9A227",
    textColor: template.colors?.text || "#2D3748",
    headerColor: template.colors?.text || "#2D3748",
  });
  const fontFamily = template.fontFamily || "'Georgia', serif";
  const certVariant: CertificateType = template.certificate_type === "birth" ? "birth" : "ownership";

  if (certVariant === "birth" || certVariant === "ownership") {
    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: template.background_url
            ? `url(${template.background_url}) center/cover no-repeat`
            : colors.bg,
          fontFamily,
          position: "relative",
          overflow: "hidden",
          fontSize: 0,
        }}
      >
        {!template.background_url && (
          <DiplomaCertificateDecor colors={colors} fontFamily={fontFamily} />
        )}
        {renderDiplomaContent(certVariant, petData, fontFamily, colors, petImageUrl, showPetPhoto)}
      </div>
    );
  }

  const fields = ((template.fields as any[]) || []).filter((f: any) => f.visible !== false);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        background: template.background_url
          ? `url(${template.background_url}) center/cover no-repeat`
          : colors.bg,
        fontFamily,
        position: "relative",
        overflow: "hidden",
        fontSize: 0,
      }}
    >
      {!template.background_url && <CertificateDecor colors={colors} fontFamily={fontFamily} />}

      {fields.map((field: any) => {
        if (field.key === "pet_photo" || field.key === "sire_photo" || field.key === "dam_photo") {
          const isPet = field.key === "pet_photo";
          const isParent = field.key === "sire_photo" || field.key === "dam_photo";
          const photoSize = isPet ? "12cqw" : "4.8cqw";
          const imageUrl =
            field.key === "sire_photo"
              ? parentPhotos?.sire || petData.sire_photo_url
              : field.key === "dam_photo"
                ? parentPhotos?.dam || petData.dam_photo_url
                : petImageUrl;
          const caption = field.key === "sire_photo" ? "Sire" : field.key === "dam_photo" ? "Dam" : undefined;
          if (isParent && !imageUrl) return null;

          return (
            <PetPhotoBox
              key={field.id}
              imageUrl={imageUrl}
              borderColor={colors.border}
              accentColor={colors.accent}
              isDark={colors.isDark}
              caption={caption}
              softFrame={false}
              placeholder={isPet ? "Pet photo" : "Parent"}
              style={{
                position: "absolute",
                left: `${field.x}%`,
                top: `${field.y}%`,
                transform: isParent ? "translateX(-100%)" : undefined,
                width: photoSize,
                height: caption ? `calc(${photoSize} + 2cqw)` : photoSize,
                zIndex: 2,
              }}
            />
          );
        }

        const isCentered = CENTERED_KEYS.has(field.key);
        const scaledFontSize = `${field.fontSize / 8}cqw`;
        const isBirthCentered = certVariant === "birth" && isCentered;

        return (
          <div
            key={field.id}
            style={{
              position: "absolute",
              left: `${field.x}%`,
              top: `${field.y}%`,
              transform: isCentered ? "translateX(-50%)" : "none",
              maxWidth: isBirthCentered
                ? field.key === "legal"
                  ? "68%"
                  : field.key === "birth_born_line"
                    ? "62%"
                    : field.key === "signature_line"
                      ? "34%"
                      : "88%"
                : isCentered
                  ? field.key === "signature_line"
                    ? "32%"
                    : "88%"
                  : field.key === "sire_name" || field.key === "dam_name" || field.key === "breeder_name" || field.key === "birth_weight" || field.key === "birth_height" || field.key === "breed_stat" || field.key === "sex_stat" || field.key === "fur_stat" || field.key === "eye_stat" || field.key === "weight_stat"
                    ? "38%"
                    : `${Math.max(20, 94 - field.x)}%`,
              fontSize: scaledFontSize,
              fontWeight: field.fontWeight,
              color: field.color,
              fontFamily: field.fontFamily || fontFamily,
              whiteSpace: WRAP_KEYS.has(field.key) ? "normal" : "nowrap",
              textAlign: isCentered ? "center" : "left",
              overflow: "hidden",
              textOverflow: "ellipsis",
              letterSpacing: field.letterSpacing || (field.fontSize <= 10 ? "0.1cqw" : field.fontSize >= 24 ? "0.18cqw" : "0"),
              textTransform: HEADER_KEYS.has(field.key) ? "uppercase" : "none",
              fontStyle: field.key === "pet_name" && certVariant !== "birth" ? "italic" : "normal",
              lineHeight: field.key === "legal" ? 1.5 : 1.3,
              zIndex: field.key === "footer" ? 5 : 3,
            }}
          >
            {field.type === "data" ? fillCertificateTemplate(field.label, petData) : field.label}
          </div>
        );
      })}
    </div>
  );
}

function renderCanvasCertificate(
  template: any,
  petData: Record<string, string>,
  petImageUrl?: string,
) {
  const colors: CertificateThemeColors = (template.colors as CertificateThemeColors) || buildThemeColors({
    bgColor: template.colors?.bg || "#FFFFFF",
    borderColor: template.colors?.border || "#B8860B",
    accentColor: template.colors?.accent || "#8B6914",
    textColor: template.colors?.text || "#2C2416",
    headerColor: template.colors?.text || "#2C2416",
  });
  const fontFamily = template.fontFamily || "'Georgia', serif";
  const elements = ((template.fields as any[]) || []).sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        background: template.background_url
          ? `url(${template.background_url}) center/cover no-repeat`
          : colors.bg,
        fontFamily,
      }}
    >
      {!template.background_url && <CertificateDecor colors={colors} fontFamily={fontFamily} />}

      {elements.map((el: any) => {
        const style: CSSProperties = {
          position: "absolute",
          left: `${(el.x / CANVAS_W) * 100}%`,
          top: `${(el.y / CANVAS_H) * 100}%`,
          width: `${(el.width / CANVAS_W) * 100}%`,
          height: `${(el.height / CANVAS_H) * 100}%`,
          opacity: el.opacity ?? 1,
          transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
          zIndex: (el.zIndex ?? 1) + 2,
        };

        if (el.type === "text") {
          return (
            <div
              key={el.id}
              style={{
                ...style,
                fontSize: `${(el.fontSize / CANVAS_W) * 100}cqw`,
                fontWeight: el.fontWeight,
                fontStyle: el.fontStyle,
                textDecoration: el.textDecoration,
                textAlign: el.textAlign as CSSProperties["textAlign"],
                fontFamily: el.fontFamily || fontFamily,
                color: el.color,
                backgroundColor: el.backgroundColor,
                borderRadius: el.borderRadius,
                letterSpacing: el.letterSpacing,
                lineHeight: el.lineHeight,
                display: "flex",
                alignItems: "center",
                justifyContent: el.textAlign === "center" ? "center" : el.textAlign === "right" ? "flex-end" : "flex-start",
                padding: "0 4px",
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {fillCertificateTemplate(el.content || "", petData)}
            </div>
          );
        }

        if (isPhotoPlaceholder(el.content)) {
          return (
            <PetPhotoBox
              key={el.id}
              imageUrl={petImageUrl}
              borderColor={el.borderColor || colors.border}
              accentColor={colors.accent}
              isDark={colors.isDark}
              style={style}
            />
          );
        }

        return (
          <div
            key={el.id}
            style={{
              ...style,
              backgroundColor: el.backgroundColor,
              borderRadius: el.borderRadius,
              borderWidth: el.borderWidth,
              borderColor: el.borderColor,
              borderStyle: el.borderWidth ? "solid" : "none",
            }}
          />
        );
      })}
    </div>
  );
}

export function getParentPhotoUrls(cert: {
  pets?: {
    sire_photo_url?: string | null;
    dam_photo_url?: string | null;
    sire?: { pet_images?: { image_url: string; sort_order: number }[] } | null;
    dam?: { pet_images?: { image_url: string; sort_order: number }[] } | null;
  } | null;
}): { sire?: string; dam?: string } {
  const pets = cert.pets;
  if (!pets) return {};
  const sireImg = pets.sire?.pet_images?.[0]?.image_url;
  const damImg = pets.dam?.pet_images?.[0]?.image_url;
  return {
    sire: pets.sire_photo_url || sireImg || undefined,
    dam: pets.dam_photo_url || damImg || undefined,
  };
}

export function renderCertificateView(
  template: any,
  petData: Record<string, string>,
  petImageUrl?: string,
  parentPhotos?: { sire?: string; dam?: string },
  showPetPhoto?: boolean,
): ReactNode {
  if (isCanvasCertificateTemplate(template)) {
    return renderCanvasCertificate(template, petData, petImageUrl);
  }
  return renderFieldCertificate(template, petData, petImageUrl, parentPhotos, showPetPhoto);
}

/** Upgrade legacy saved templates to latest typed layouts. */
export function ensureCertificateTemplateFields(template: any, certificateType?: CertificateType) {
  if (!template?.fields || isCanvasCertificateTemplate(template)) return template;

  const type: CertificateType =
    certificateType ||
    template.certificate_type ||
    (template.id?.includes("birth") ? "birth" : "ownership");

  if (type === "birth") return buildBirthCertificateTemplate();
  return buildOwnershipCertificateTemplate();
}
