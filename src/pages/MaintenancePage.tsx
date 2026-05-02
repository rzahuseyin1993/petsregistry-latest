import { useEffect } from "react";
import { Wrench } from "lucide-react";

const message =
  import.meta.env.VITE_MAINTENANCE_MESSAGE ||
  "We are performing scheduled maintenance. Please check back soon.";

export default function MaintenancePage() {
  useEffect(() => {
    document.title = "Under maintenance";
  }, []);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-background to-muted/30 px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
        <Wrench className="h-8 w-8" aria-hidden />
      </div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
        We will be back shortly
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground leading-relaxed">{message}</p>
      <p className="mt-8 text-xs text-muted-foreground">Thank you for your patience.</p>
    </div>
  );
}
