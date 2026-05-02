import { useQuery } from "@tanstack/react-query";
import { Navigate, Outlet } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const MobileGuard = () => {
  const { data: enabled, isLoading } = useQuery({
    queryKey: ["mobile-site-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "mobile_site_enabled")
        .maybeSingle();
      return data?.value !== "false";
    },
    staleTime: 60_000,
  });

  if (isLoading) return null;
  if (!enabled) return <Navigate to="/" replace />;
  return <Outlet />;
};

export default MobileGuard;
