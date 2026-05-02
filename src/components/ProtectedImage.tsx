import * as React from "react";
import { cn } from "@/lib/utils";

interface ProtectedImageProps {
  src: string;
  alt: string;
  className?: string;
  watermarkText?: string;
  loading?: "lazy" | "eager";
  width?: number;
  height?: number;
}

const ProtectedImage = React.forwardRef<HTMLDivElement, ProtectedImageProps>(
  (
    {
      src,
      alt,
      className,
      watermarkText = "Pet Palace Hub",
      loading = "lazy",
      width,
      height,
    },
    ref,
  ) => (
    <div ref={ref} className="relative overflow-hidden select-none">
      <img
        src={src}
        alt={alt}
        className={cn("h-full w-full", className?.includes("object-contain") ? "" : "object-cover", className)}
        loading={loading}
        width={width}
        height={height}
        draggable={false}
        onContextMenu={(e) => e.preventDefault()}
      />
      {/* Repeating diagonal watermark overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-10"
        aria-hidden="true"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 80px,
            rgba(255,255,255,0.06) 80px,
            rgba(255,255,255,0.06) 81px
          )`,
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-wrap items-center justify-center gap-x-16 gap-y-12 overflow-hidden"
        aria-hidden="true"
      >
        {Array.from({ length: 6 }).map((_, i) => (
          <span
            key={i}
            className="whitespace-nowrap text-[10px] font-bold uppercase tracking-widest opacity-[0.08] rotate-[-30deg]"
            style={{ color: "hsl(var(--foreground))" }}
          >
            {watermarkText}
          </span>
        ))}
      </div>
    </div>
  ),
);
ProtectedImage.displayName = "ProtectedImage";

export default ProtectedImage;
