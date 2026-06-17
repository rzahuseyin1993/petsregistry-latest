import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useStoreEnabled() {
  const { data: storeEnabled = true, isLoading } = useQuery({
    queryKey: ["store-enabled"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "store_enabled")
        .maybeSingle();
      if (error) throw error;
      return data?.value !== "false";
    },
    staleTime: 60_000,
  });

  return { storeEnabled, isLoading };
}
