import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_SITE_EMAIL = "support@petsregistry.org";

/** Public contact email shown on the site (footer, contact page). Configurable via Admin Settings > Site Email. */
export function useSiteEmail() {
  const { data: siteEmail = DEFAULT_SITE_EMAIL } = useQuery({
    queryKey: ["site-email"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("value")
        .eq("key", "site_email")
        .maybeSingle();
      if (error) throw error;
      return data?.value?.trim() || DEFAULT_SITE_EMAIL;
    },
    staleTime: 5 * 60_000,
  });

  return siteEmail;
}
