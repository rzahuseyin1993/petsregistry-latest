import { useCallback, useMemo } from "react";
import { useLocation, useSearchParams } from "react-router-dom";
import { useVisitorGeo } from "@/contexts/VisitorGeoContext";
import {
  countryStringToVisitor,
  getCountryLabel,
  getVisitorCountryFilter,
  type VisitorCountry,
} from "@/lib/geoCountry";
import { buildLostPetsCountryFeedUrl, getLostPetsCountryFeedPath } from "@/lib/lostPetsRoutes";

export type BrowseCountryMode = "auto" | "all" | "custom";

export function useBrowseCountryFilter() {
  const { visitorCountry, countryLabel, isLoading: geoLoading } = useVisitorGeo();
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const isMobile = location.pathname.startsWith("/m");

  const urlCountry = searchParams.get("country");

  const mode: BrowseCountryMode = useMemo(() => {
    if (urlCountry === "all") return "all";
    if (urlCountry) return "custom";
    return "auto";
  }, [urlCountry]);

  const customCountry = mode === "custom" && urlCountry ? urlCountry : "";

  const effectiveCountry: VisitorCountry | null = useMemo(() => {
    if (mode === "all") return null;
    if (mode === "custom" && customCountry) {
      return countryStringToVisitor(customCountry);
    }
    return visitorCountry;
  }, [mode, customCountry, visitorCountry]);

  const activeLabel = useMemo(() => {
    if (mode === "all") return null;
    if (mode === "custom" && customCountry) return customCountry;
    return countryLabel;
  }, [mode, customCountry, countryLabel]);

  const isFiltering = mode !== "all" && !!getVisitorCountryFilter(effectiveCountry);

  const selectedCountryValue = useMemo(() => {
    if (mode === "custom" && customCountry) return customCountry;
    if (mode === "auto" && countryLabel) return countryLabel;
    return "";
  }, [mode, customCountry, countryLabel]);

  const setCountryParam = useCallback(
    (value: string | null) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (!value) next.delete("country");
          else next.set("country", value);
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const selectCountry = useCallback(
    (country: string) => {
      if (!country.trim()) return;
      setCountryParam(country.trim());
    },
    [setCountryParam],
  );

  const showAllCountries = useCallback(() => {
    setCountryParam("all");
  }, [setCountryParam]);

  const resetToAuto = useCallback(() => {
    setCountryParam(null);
  }, [setCountryParam]);

  const shareCountryLabel = useMemo(() => {
    if (mode === "all") return null;
    if (mode === "custom" && customCountry) return customCountry;
    return getCountryLabel(visitorCountry);
  }, [mode, customCountry, visitorCountry]);

  const sharePath = useMemo(() => {
    if (!shareCountryLabel) return null;
    return getLostPetsCountryFeedPath(shareCountryLabel, { mobile: isMobile });
  }, [shareCountryLabel, isMobile]);

  const shareUrl = useMemo(() => {
    if (!shareCountryLabel) return null;
    return buildLostPetsCountryFeedUrl(shareCountryLabel, { mobile: isMobile });
  }, [shareCountryLabel, isMobile]);

  return {
    mode,
    effectiveCountry,
    activeLabel,
    isFiltering,
    selectedCountryValue,
    geoLoading,
    selectCountry,
    showAllCountries,
    resetToAuto,
    sharePath,
    shareUrl,
    shareCountryLabel,
    countryFilterKey: getVisitorCountryFilter(effectiveCountry) ?? "all",
  };
}
