import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCountryLabel,
  getVisitorCountryFilter,
  resolveEffectiveCountry,
  type CountrySource,
  type VisitorCountry,
} from "@/lib/geoCountry";

type VisitorGeoContextValue = {
  /** IP-detected country (guests). */
  ipCountry: VisitorCountry | null;
  /** Effective country: member profile country, else IP. */
  visitorCountry: VisitorCountry | null;
  countrySource: CountrySource;
  countryFilter: string | null;
  countryLabel: string | null;
  isLoading: boolean;
};

const VisitorGeoContext = createContext<VisitorGeoContextValue>({
  ipCountry: null,
  visitorCountry: null,
  countrySource: null,
  countryFilter: null,
  countryLabel: null,
  isLoading: true,
});

async function fetchIpCountry(): Promise<VisitorCountry | null> {
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
  const { profile, loading: authLoading } = useAuth();

  const { data: ipCountry = null, isLoading: ipLoading } = useQuery({
    queryKey: ["visitor-country", import.meta.env.VITE_DEV_VISITOR_COUNTRY],
    queryFn: fetchIpCountry,
    staleTime: 1000 * 60 * 30,
    retry: 1,
  });

  const { visitorCountry, countrySource } = useMemo(() => {
    const resolved = resolveEffectiveCountry(profile?.country, ipCountry);
    return { visitorCountry: resolved.country, countrySource: resolved.source };
  }, [profile?.country, ipCountry]);

  const countryFilter = useMemo(
    () => getVisitorCountryFilter(visitorCountry),
    [visitorCountry],
  );

  const countryLabel = useMemo(() => getCountryLabel(visitorCountry), [visitorCountry]);

  const value = useMemo(
    () => ({
      ipCountry,
      visitorCountry,
      countrySource,
      countryFilter,
      countryLabel,
      isLoading: authLoading || ipLoading,
    }),
    [ipCountry, visitorCountry, countrySource, countryFilter, countryLabel, authLoading, ipLoading],
  );

  return <VisitorGeoContext.Provider value={value}>{children}</VisitorGeoContext.Provider>;
}

export function useVisitorGeo() {
  return useContext(VisitorGeoContext);
}
