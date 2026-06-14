export function getLostPetsCountryFeedPath(country: string, opts?: { mobile?: boolean }) {
  const segment = encodeURIComponent(country.trim());
  return opts?.mobile ? `/m/lost-pets/country/${segment}` : `/lost-pets/country/${segment}`;
}

export function buildLostPetsCountryFeedUrl(country: string, opts?: { mobile?: boolean }) {
  if (typeof window === "undefined") {
    return getLostPetsCountryFeedPath(country, opts);
  }
  return `${window.location.origin}${getLostPetsCountryFeedPath(country, opts)}`;
}
