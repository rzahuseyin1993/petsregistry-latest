import { useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import MaintenancePage from "@/pages/MaintenancePage";
import { resolveMaintenanceMode } from "@/lib/maintenanceMode";

const MaintenanceGate = ({ children }: { children: ReactNode }) => {
  const [checking, setChecking] = useState(true);
  const [maintenance, setMaintenance] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const { data } = await supabase
          .from("site_settings")
          .select("value")
          .eq("key", "maintenance_mode")
          .maybeSingle();

        if (!cancelled) {
          setMaintenance(resolveMaintenanceMode(data?.value));
        }
      } catch {
        if (!cancelled) {
          setMaintenance(resolveMaintenanceMode(undefined));
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (maintenance) return <MaintenancePage />;
  return <>{children}</>;
};

export default MaintenanceGate;
