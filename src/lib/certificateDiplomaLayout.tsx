import type { CSSProperties, ReactNode } from "react";
import logo from "@/assets/logo.png";
import officialSeal from "@/assets/official-seal.png";
import { DiplomaCornerBrackets, OrnatePhotoFrame } from "@/lib/certificateOrnaments";
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

function OfficialEmbossedSeal() {
  return (
    <img
      src={officialSeal}
      alt="Official seal"
      style={{
        position: "absolute",
        right: "6.5%",
        bottom: "7%",
        width: "11.5cqw",
        height: "auto",
        zIndex: 4,
        pointerEvents: "none",
        objectFit: "contain",
      }}
    />
  );
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
        }}
      />

      <OfficialEmbossedSeal />
    </>
  );
}

function FormSection({
  top,
  children,
  rightInset,
}: {
  top: string;
  children: ReactNode;
  rightInset?: string;
}) {
  return (
    <div
      style={{
        position: "absolute",
        left: "8%",
        right: rightInset || "8%",
        top,
        zIndex: 3,
        display: "flex",
        flexDirection: "column",
        gap: "2.2cqw",
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
            width: "13cqw",
            height: "13cqw",
            zIndex: 4,
          }}
        />
      )}

      <FormSection top="35%" rightInset={withPhoto ? "25%" : undefined}>
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
      </FormSection>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "60%",
          transform: "translateX(-50%)",
          width: "84%",
          textAlign: "center",
          fontSize: "1.45cqw",
          lineHeight: 1.55,
          color: bodyColor,
          fontFamily,
          zIndex: 3,
        }}
      >
        This certifies that the pet described above has been officially registered with Pets Registry.
      </div>

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
            width: "13cqw",
            height: "13cqw",
            zIndex: 4,
          }}
        />
      )}

      <FormSection top="33%" rightInset={withPhoto ? "25%" : undefined}>
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
      </FormSection>

      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "61%",
          transform: "translateX(-50%)",
          width: "82%",
          textAlign: "center",
          fontSize: "1.4cqw",
          lineHeight: 1.55,
          color: bodyColor,
          fontFamily,
          zIndex: 3,
        }}
      >
        This certifies that <strong>{petData.pet_name || "—"}</strong> is the lawful companion of{" "}
        <strong>{ownerDisplay || "—"}</strong> and is officially registered with Pets Registry.
      </div>

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
          right: "22%",
          top: "77%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "4cqw",
          zIndex: 3,
        }}
      >
        <DiplomaFormField label="Date" value={petData.date_issued} width="38%" fontFamily={fontFamily} color={bodyColor} fontSize={fieldSize} />
        <div style={{ flex: 1, fontFamily, fontSize: footerLabelSize, color: bodyColor }}>
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
      </div>

      <div
        style={{
          position: "absolute",
          left: "8%",
          top: "85%",
          width: "52%",
          zIndex: 3,
        }}
      >
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
