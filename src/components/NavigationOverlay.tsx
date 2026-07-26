import { Loader2 } from "lucide-react";

type NavigationOverlayProps = {
  /** Full-page blocker (Suspense initial load) vs overlay on top of current page */
  mode?: "overlay" | "page";
};

/** Visible waiting spinner while the next route chunk loads */
const NavigationOverlay = ({ mode = "overlay" }: NavigationOverlayProps) => {
  const spinner = (
    <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-lg">
      <Loader2 className="h-7 w-7 animate-spin text-primary" aria-hidden />
    </div>
  );

  if (mode === "page") {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        aria-live="polite"
        aria-busy="true"
        role="status"
      >
        {spinner}
        <span className="sr-only">Loading</span>
      </div>
    );
  }

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center"
      aria-live="polite"
      aria-busy="true"
      role="status"
    >
      <div className="pointer-events-none absolute inset-0 bg-background/50 backdrop-blur-[1px]" />
      <div className="relative">{spinner}</div>
      <span className="sr-only">Loading</span>
    </div>
  );
};

export default NavigationOverlay;
