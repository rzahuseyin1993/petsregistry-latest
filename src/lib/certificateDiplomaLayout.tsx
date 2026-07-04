import type { CSSProperties, ReactNode } from "react";
import logo from "@/assets/logo.png";
import { DiplomaCornerBrackets, OrnatePhotoFrame, PetsRegistryOfficialSeal } from "@/lib/certificateOrnaments";
import type { CertificateThemeColors } from "@/lib/certificateDesign";
import type { CertificateType } from "@/lib/certificateTypes";

function valOk(v?: string): boolean {
  return !!v?.trim() && v.trim() !== "—";
}

function DiplomaFormField({
  label,
  value,
  width,
  fontFamily,
  color = "#2D3748",
  fontSize = "1.15cqw",
}: {
  label: string;
  value?: string;
  width: string;
  fontFamily: string;
  color?: string;
  fontSize?: string;
}) {
  const display = valOk(value) ? value!.trim() : "";
  return (
    <div style={{ width, minWidth: 0, display: "flex", alignItems: "baseline", gap: "0.4cqw", fontFamily, fontSize, color }}>
      <span style={{ whiteSpace: "nowrap", flexShrink: 0 }}>{label}</span>
      <span
        style={{
          flex: 1,
          minWidth: 0,
          borderBottom: `1px solid ${color}88`,
          minHeight: `calc(${fontSize} * 1.2)`,
          paddingBottom: "0.15cqw",
          fontWeight: display ? 600 : 400,
          whiteSpace: "normal",
          wordBreak: "break-word",
          lineHeight: 1.25,
        }}
      >
        {display}
      </span>
    </div>
  );
}

function OfficialEmbossedSeal({ accent, border }: { accent: string; border: string }) {
  return <PetsRegistryOfficialSeal accent={accent} border={border} size="16cqw" />;
}

export function DiplomaCertificateDecor({
  colors,
}: {
  colors: CertificateThemeColors;
  fontFamily: string;
}) {
  const { bg, border, accent } = colors;
  const goldLine = `${accent}99`;
  const navyLine = `${border}88`;

  return (
    <>
      <div style={{ position: "absolute", inset: 0, background: bg, zIndex: 0 }} />

      {/* Gold outer + navy inner frame */}
      <div
        style={{
          position: "absolute",
          inset: "1.4%",
          border: `1.5px solid ${accent}`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "2.1%",
          border: `2.5px solid ${border}`,
          pointerEvents: "none",
          zIndex: 1,
          boxShadow: `inset 0 0 0 1px ${goldLine}`,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: "3.2%",
          border: `1px solid ${navyLine}`,
          pointerEvents: "none",
          zIndex: 1,
        }}
      />

      <DiplomaCornerBrackets accent={accent} border={border} />

      {/* Logo */}
      <img
        src={logo}
        alt="Pets Registry"
        crossOrigin="anonymous"
        decoding="sync"
        style={{
          position: "absolute",
          left: "50%",
          top: "4.5%",
          transform: "translateX(-50%)",
          height: "8cqw",
          width: "auto",
          maxWidth: "42%",
          objectFit: "contain",
          zIndex: 3,
          pointerEvents: "none",
          imageRendering: "auto",
        }}
      />

      <OfficialEmbossedSeal accent={accent} border={border} />
    </>
  );
}

function FormSection({
  top,
  children,
  rightInset,
  gap = "1.5cqw",
}: {
  top: string;
  children: ReactNode;
  rightInset?: string;
  gap?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: rightInset || "8%",
        top,
        bottom: "22%",
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        gap,
      }}
    >
      {children}
    </div>
  );
}

function FormRow({ children, gap = "2.5cqw" }: { children: ReactNode; gap?: string }) {
  return (
    <div style={{ display: "flex", gap, alignItems: "flex-end", width: "100%" }}>
      {children}
    </div>
  );
}

/** ~14px at full certificate width (594px); scales down in list thumbnails */
const CERTIFICATION_FONT = "clamp(5px, 2.36cqw, 14px)";

function DiplomaCertificationLine({
  children,
  fontFamily,
  color,
}: {
  children: ReactNode;
  fontFamily: string;
  color: string;
}) {
  return (
    <p
      style={{
        margin: "0.25cqw 0 0",
        padding: "0 2%",
        textAlign: "center",
        fontSize: CERTIFICATION_FONT,
        lineHeight: 1.35,
        color,
        fontFamily,
        flexShrink: 0,
      }}
    >
      {children}
    </p>
  );
}

export function BirthDiplomaContent({
  petData,
  fontFamily,
  colors,
  petImageUrl,
  showPetPhoto,
}: {
  petData: Record<string, string>;
  fontFamily: string;
  colors: CertificateThemeColors;
  petImageUrl?: string;
  showPetPhoto?: boolean;
}) {
  const bodyColor = colors.text;
  const fieldSize = "1.55cqw";
  const withPhoto = !!(showPetPhoto && petImageUrl);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "21.5%",
          transform: "translateX(-50%)",
          fontSize: "2.65cqw",
          fontWeight: 700,
          color: colors.border,
          letterSpacing: "0.26cqw",
          fontFamily,
          zIndex: 3,
          whiteSpace: "nowrap",
        }}
      >
        PET BIRTH CERTIFICATE
      </div>

      {withPhoto && (
        <OrnatePhotoFrame
          imageUrl={petImageUrl}
          borderColor={colors.border}
          accentColor={colors.accent}
          placeholder="Pet photo"
          style={{
            position: "absolute",
            right: "7%",
            top: "31%",
            width: "16cqw",
            height: "16cqw",
            zIndex: 4,
          }}
        />
      )}

      <FormSection top="34%" rightInset={withPhoto ? "28%" : undefined} gap="1.4cqw">
        <FormRow>
          <DiplomaFormField label="Pet Name:" value={petData.pet_name} width="40%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Species:" value={petData.species} width="24%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Breed:" value={petData.breed} width="32%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <FormRow>
          <DiplomaFormField label="Date of Birth:" value={petData.birth_date_full} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Place of Birth:" value={petData.birth_location} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <FormRow>
          <DiplomaFormField label="Sex:" value={petData.sex} width="28%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Weight at Birth:" value={petData.birth_weight} width="68%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <FormRow>
          <DiplomaFormField label="Dam (Mother):" value={petData.dam_name} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Sire (Father):" value={petData.sire_name} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <DiplomaCertificationLine fontFamily={fontFamily} color={bodyColor}>
          This certifies that the pet described above has been officially registered with PetsRegister.org.
        </DiplomaCertificationLine>
      </FormSection>

      <DiplomaFooter petData={petData} fontFamily={fontFamily} colors={colors} fieldSize={fieldSize} />
    </>
  );
}

export function OwnershipDiplomaContent({
  petData,
  fontFamily,
  colors,
  petImageUrl,
  showPetPhoto,
}: {
  petData: Record<string, string>;
  fontFamily: string;
  colors: CertificateThemeColors;
  petImageUrl?: string;
  showPetPhoto?: boolean;
}) {
  const bodyColor = colors.text;
  const ownerDisplay = petData.issued_for_name?.trim() || petData.owner_name;
  const fieldSize = "1.4cqw";
  const withPhoto = !!(showPetPhoto && petImageUrl);

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "21.5%",
          transform: "translateX(-50%)",
          fontSize: "2.45cqw",
          fontWeight: 700,
          color: colors.border,
          letterSpacing: "0.2cqw",
          fontFamily,
          zIndex: 3,
          whiteSpace: "nowrap",
          textAlign: "center",
        }}
      >
        PET OWNERSHIP CERTIFICATE
      </div>

      {withPhoto && (
        <OrnatePhotoFrame
          imageUrl={petImageUrl}
          borderColor={colors.border}
          accentColor={colors.accent}
          placeholder="Pet photo"
          style={{
            position: "absolute",
            right: "7%",
            top: "31%",
            width: "16cqw",
            height: "16cqw",
            zIndex: 4,
          }}
        />
      )}

      <FormSection top="32%" rightInset={withPhoto ? "28%" : undefined} gap="1.35cqw">
        <DiplomaFormField label="Pet Owner Name:" value={ownerDisplay} width="100%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        <DiplomaFormField label="Pet Name:" value={petData.pet_name} width="100%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        <FormRow>
          <DiplomaFormField label="Species:" value={petData.species} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Breed:" value={petData.breed} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <FormRow>
          <DiplomaFormField label="Date of Birth:" value={petData.birth_date_full} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Place of Birth:" value={petData.birth_location} width="48%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <FormRow>
          <DiplomaFormField label="Sex:" value={petData.sex} width="30%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
          <DiplomaFormField label="Color/Markings:" value={petData.color} width="66%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        </FormRow>
        <DiplomaCertificationLine fontFamily={fontFamily} color={bodyColor}>
          This certifies that <strong>{petData.pet_name || "—"}</strong> is the lawful companion of{" "}
          <strong>{ownerDisplay || "—"}</strong> and is officially registered with PetsRegister.org.
        </DiplomaCertificationLine>
      </FormSection>

      <DiplomaFooter petData={petData} fontFamily={fontFamily} colors={colors} fieldSize={fieldSize} />
    </>
  );
}

function DiplomaFooter({
  petData,
  fontFamily,
  colors,
  fieldSize = "1.15cqw",
}: {
  petData: Record<string, string>;
  fontFamily: string;
  colors: CertificateThemeColors;
  fieldSize?: string;
}) {
  const bodyColor = colors.text;
  const sigFont = "'Segoe Script', 'Brush Script MT', 'Palatino Linotype', cursive";
  const footerLabelSize = `calc(${fieldSize} * 0.95)`;

  return (
    <>
      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "80%",
          width: "38%",
          display: "flex",
          flexDirection: "column",
          gap: "1.6cqw",
          zIndex: 3,
        }}
      >
        <DiplomaFormField label="Date" value={petData.date_issued} width="100%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        <DiplomaFormField
          label="Registry ID No.:"
          value={petData.certificate_number}
          width="100%"
          fontFamily={fontFamily}
          color={bodyColor}
          fontSize={fieldSize}
        />
      </div>

      <div
        style={{
          position: "absolute",
          left: "46%",
          right: "22%",
          top: "80%",
          fontFamily,
          fontSize: footerLabelSize,
          color: bodyColor,
          zIndex: 3,
        }}
      >
        <div style={{ marginBottom: "0.25cqw" }}>Official Registrar Signature:</div>
        <div
          style={{
            borderBottom: `1px solid ${bodyColor}88`,
            minHeight: "2.2cqw",
            fontFamily: sigFont,
            fontSize: `calc(${fieldSize} * 1.15)`,
            color: "#1A4B8C",
            paddingBottom: "0.15cqw",
          }}
        >
          Pets Registry
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: "4.5%",
          transform: "translateX(-50%)",
          fontSize: `calc(${fieldSize} * 0.85)`,
          fontWeight: 600,
          color: colors.accent,
          letterSpacing: "0.12cqw",
          fontFamily,
          zIndex: 5,
          whiteSpace: "nowrap",
        }}
      >
        Verify at petsregistry.org/verify
      </div>
    </>
  );
}

export function renderDiplomaContent(
  type: CertificateType,
  petData: Record<string, string>,
  fontFamily: string,
  colors: CertificateThemeColors,
  petImageUrl?: string,
  showPetPhoto?: boolean,
) {
  if (type === "birth") {
    return <BirthDiplomaContent petData={petData} fontFamily={fontFamily} colors={colors} petImageUrl={petImageUrl} showPetPhoto={showPetPhoto} />;
  }
  return <OwnershipDiplomaContent petData={petData} fontFamily={fontFamily} colors={colors} petImageUrl={petImageUrl} showPetPhoto={showPetPhoto} />;
}
