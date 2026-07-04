import type { CSSProperties } from "react";
import { useId } from "react";
import logo from "@/assets/logo.png";

/** Minimal elegant corner — single gold L-bracket with navy accent curl */
export function CornerFlourish({
  position,
  color = "#C9A227",
  secondary = "#1B2838",
  size = "5cqw",
}: {
  position: "tl" | "tr" | "bl" | "br";
  color?: string;
  secondary?: string;
  size?: string;
}) {
  const flipX = position.includes("r");
  const flipY = position.includes("b");
  const style: CSSProperties = {
    position: "absolute",
    width: size,
    height: size,
    top: position.includes("t") ? "2.4%" : undefined,
    bottom: position.includes("b") ? "2.4%" : undefined,
    left: position.includes("l") ? "2.4%" : undefined,
    right: position.includes("r") ? "2.4%" : undefined,
    pointerEvents: "none",
    zIndex: 2,
    transform: `scale(${flipX ? -1 : 1}, ${flipY ? -1 : 1})`,
  };

  return (
    <svg viewBox="0 0 48 48" style={style} aria-hidden>
      <path d="M2 2 H30" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square" />
      <path d="M2 2 V30" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="square" />
      <path d="M6 6 H22" fill="none" stroke={secondary} strokeWidth="1" strokeLinecap="square" opacity="0.7" />
      <path d="M6 6 V22" fill="none" stroke={secondary} strokeWidth="1" strokeLinecap="square" opacity="0.7" />
      <path
        d="M2 2 Q16 2 22 16"
        fill="none"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity="0.85"
      />
    </svg>
  );
}

/** Clean certificate corner brackets — used on diploma certificates */
export function DiplomaCornerBrackets({
  accent,
  border,
}: {
  accent: string;
  border: string;
}) {
  const corners = [
    { top: "2.6%", left: "2.6%", borderTop: true, borderLeft: true },
    { top: "2.6%", right: "2.6%", borderTop: true, borderRight: true },
    { bottom: "2.6%", left: "2.6%", borderBottom: true, borderLeft: true },
    { bottom: "2.6%", right: "2.6%", borderBottom: true, borderRight: true },
  ];

  return (
    <>
      {corners.map((c, i) => (
        <div
          key={i}
          style={{
            position: "absolute",
            width: "4.2cqw",
            height: "4.2cqw",
            top: c.top,
            left: c.left,
            right: c.right,
            bottom: c.bottom,
            borderTop: c.borderTop ? `2.5px solid ${accent}` : undefined,
            borderLeft: c.borderLeft ? `2.5px solid ${accent}` : undefined,
            borderRight: c.borderRight ? `2.5px solid ${accent}` : undefined,
            borderBottom: c.borderBottom ? `2.5px solid ${accent}` : undefined,
            pointerEvents: "none",
            zIndex: 2,
          }}
        />
      ))}
      {corners.map((c, i) => {
        const inset = "0.9cqw";
        return (
          <div
            key={`inner-${i}`}
            style={{
              position: "absolute",
              width: "2.6cqw",
              height: "2.6cqw",
              top: c.top ? `calc(${c.top} + ${inset})` : undefined,
              bottom: c.bottom ? `calc(${c.bottom} + ${inset})` : undefined,
              left: c.left ? `calc(${c.left} + ${inset})` : undefined,
              right: c.right ? `calc(${c.right} + ${inset})` : undefined,
              borderTop: c.borderTop ? `1px solid ${border}` : undefined,
              borderLeft: c.borderLeft ? `1px solid ${border}` : undefined,
              borderRight: c.borderRight ? `1px solid ${border}` : undefined,
              borderBottom: c.borderBottom ? `1px solid ${border}` : undefined,
              pointerEvents: "none",
              zIndex: 2,
              opacity: 0.5,
            }}
          />
        );
      })}
    </>
  );
}

/** Decorative gold photo frame with clean corners */
export function OrnatePhotoFrame({
  imageUrl,
  borderColor,
  accentColor,
  style,
  placeholder = "Pet photo",
}: {
  imageUrl?: string;
  borderColor: string;
  accentColor: string;
  style: CSSProperties;
  placeholder?: string;
}) {
  return (
    <div style={{ ...style, zIndex: 3 }}>
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          padding: "0.45cqw",
          background: accentColor,
          boxShadow: "0 2px 10px rgba(27,40,56,0.12)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            padding: "0.3cqw",
            background: "#fff",
            border: `1px solid ${borderColor}44`,
          }}
        >
          {(["tl", "tr", "bl", "br"] as const).map((c) => (
            <div
              key={c}
              style={{
                position: "absolute",
                width: "1.6cqw",
                height: "1.6cqw",
                top: c.includes("t") ? 0 : undefined,
                bottom: c.includes("b") ? 0 : undefined,
                left: c.includes("l") ? 0 : undefined,
                right: c.includes("r") ? 0 : undefined,
                borderTop: c.includes("t") ? `2px solid ${accentColor}` : undefined,
                borderLeft: c.includes("l") ? `2px solid ${accentColor}` : undefined,
                borderRight: c.includes("r") ? `2px solid ${accentColor}` : undefined,
                borderBottom: c.includes("b") ? `2px solid ${accentColor}` : undefined,
                pointerEvents: "none",
              }}
            />
          ))}

          {imageUrl ? (
            <img
              src={imageUrl}
              alt="Pet"
              crossOrigin="anonymous"
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                display: "block",
                background: "#fafafa",
              }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                background: "#faf8f5",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "1.2cqw",
                color: "#999",
                textAlign: "center",
                padding: "4px",
              }}
            >
              {placeholder}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function buildScallopPath(cx: number, cy: number, outer: number, inner: number, teeth: number): string {
  const pts: string[] = [];
  const steps = teeth * 2;
  for (let i = 0; i < steps; i++) {
    const angle = (i * Math.PI * 2) / steps - Math.PI / 2;
    const r = i % 2 === 0 ? outer : inner;
    pts.push(`${cx + r * Math.cos(angle)},${cy + r * Math.sin(angle)}`);
  }
  return `M ${pts.join(" L ")} Z`;
}

/** Official Pets Registry embossed seal — scalloped gold ring with logo center */
export function PetsRegistryOfficialSeal({
  accent = "#C9A227",
  border = "#1B2838",
  size = "16cqw",
}: {
  accent?: string;
  border?: string;
  size?: string;
}) {
  const uid = useId().replace(/:/g, "");
  const scallop = buildScallopPath(100, 100, 97, 88, 36);

  return (
    <div
      style={{
        position: "absolute",
        right: "5%",
        bottom: "5.5%",
        width: size,
        height: size,
        zIndex: 4,
        pointerEvents: "none",
      }}
      aria-hidden
    >
      <svg
        viewBox="0 0 200 200"
        width="100%"
        height="100%"
        role="img"
        aria-label="Pets Registry official seal"
        shapeRendering="geometricPrecision"
        textRendering="geometricPrecision"
      >
        <defs>
          <radialGradient id={`${uid}-gold`} cx="38%" cy="32%" r="68%">
            <stop offset="0%" stopColor="#F5E6A8" />
            <stop offset="45%" stopColor={accent} />
            <stop offset="100%" stopColor="#9A7B1A" />
          </radialGradient>
          <radialGradient id={`${uid}-face`} cx="50%" cy="42%" r="55%">
            <stop offset="0%" stopColor="#FFFFFF" />
            <stop offset="100%" stopColor="#F4F0E6" />
          </radialGradient>
          <linearGradient id={`${uid}-rim`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={accent} stopOpacity="0.9" />
            <stop offset="100%" stopColor={border} stopOpacity="0.85" />
          </linearGradient>
          <clipPath id={`${uid}-iconClip`}>
            <circle cx="100" cy="100" r="42" />
          </clipPath>
        </defs>

        <path d={scallop} fill={`url(#${uid}-gold)`} stroke={border} strokeWidth="1.2" />

        <circle cx="100" cy="100" r="82" fill="none" stroke={`url(#${uid}-rim)`} strokeWidth="2.2" />
        <circle cx="100" cy="100" r="76" fill="none" stroke={accent} strokeWidth="0.8" opacity="0.7" />

        <path id={`${uid}-top`} d="M 38 102 A 62 62 0 0 1 162 102" fill="none" />
        <text
          fontSize="9.5"
          fontWeight="700"
          fill={border}
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="2.5"
        >
          <textPath href={`#${uid}-top`} startOffset="50%" textAnchor="middle">
            OFFICIAL SEAL
          </textPath>
        </text>

        <path id={`${uid}-bot`} d="M 162 98 A 62 62 0 0 1 38 98" fill="none" />
        <text
          fontSize="7.2"
          fontWeight="700"
          fill={border}
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="1.2"
        >
          <textPath href={`#${uid}-bot`} startOffset="50%" textAnchor="middle">
            REGISTERED &amp; PROTECTED
          </textPath>
        </text>

        <circle cx="100" cy="100" r="54" fill={`url(#${uid}-face)`} stroke={accent} strokeWidth="1.4" />

        {/* Icon only — crop left mark from full logo (hide wordmark text) */}
        <g clipPath={`url(#${uid}-iconClip)`}>
          <image
            href={logo}
            x="60"
            y="60"
            width="80"
            height="80"
            preserveAspectRatio="xMinYMid slice"
            crossOrigin="anonymous"
          />
        </g>

        {[
          { x: 100, y: 34 },
          { x: 34, y: 100 },
          { x: 166, y: 100 },
        ].map((s, i) => (
          <polygon
            key={i}
            points={`${s.x},${s.y - 3} ${s.x + 1},${s.y - 1} ${s.x + 3},${s.y - 1} ${s.x + 1.5},${s.y + 0.5} ${s.x + 2},${s.y + 3} ${s.x},${s.y + 1.5} ${s.x - 2},${s.y + 3} ${s.x - 1.5},${s.y + 0.5} ${s.x - 3},${s.y - 1} ${s.x - 1},${s.y - 1}`}
            fill={accent}
            opacity="0.85"
          />
        ))}
      </svg>
    </div>
  );
}
