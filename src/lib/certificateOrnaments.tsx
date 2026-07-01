import type { CSSProperties } from "react";

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
