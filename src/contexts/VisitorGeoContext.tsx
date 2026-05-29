import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { VisitorCountry } from "@/lib/geoCountry";

type VisitorGeoContextValue = {
  visitorCountry: VisitorCountry | null;
  countryFilter: string | null;
  isLoading: boolean;
};

const VisitorGeoContext = createContext<VisitorGeoContextValue>({
  visitorCountry: null,
  countryFilter: null,
  isLoading: true,
});

async function fetchVisitorCountry(): Promise<VisitorCountry | null> {
  const devOverride = import.meta.env.VITE_DEV_VISITOR_COUNTRY?.trim();

  const { data, error } = await supabase.functions.invoke("visitor-country", {
    body: devOverride ? { country: devOverride } : {},
  });
  if (error) {
    console.warn("visitor-country:", error.message);
    return null;
  }

  const body = data as VisitorCountry & { error?: string };
  if (!body || body.error) return null;

  return {
    countryCode: body.countryCode ?? null,
    countryName: body.countryName ?? null,
  };
}

export function VisitorGeoProvider({ children }: { children: ReactNode }) {
  const { data: visitorCountry = null, isLoading } = useQuery({
    queryKey: ["visitor-country", import.meta.env.VITE_DEV_VISITOR_COUNTRY],
    queryFn: fetchVisitorCountry,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const countryFilter = useMemo(() => {
    if (!visitorCountry) return null;
    const code = visitorCountry.countryCode?.trim();
    if (code && code.length === 2) return code;
    return visitorCountry.countryName?.trim() || null;
  }, [visitorCountry]);

  const value = useMemo(
    () => ({ visitorCountry, countryFilter, isLoading }),
    [visitorCountry, countryFilter, isLoading],
  );

  return <VisitorGeoContext.Provider value={value}>{children}</VisitorGeoContext.Provider>;
}

export function useVisitorGeo() {
  return useContext(VisitorGeoContext);
}
