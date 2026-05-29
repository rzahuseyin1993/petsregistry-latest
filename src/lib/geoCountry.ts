export type VisitorCountry = {
  countryCode: string | null;
  countryName: string | null;
};

/** Country filter token for RPC / SQL (code preferred, then name). */
export function getVisitorCountryFilter(visitor: VisitorCountry | null | undefined): string | null {
  if (!visitor) return null;
  const code = visitor.countryCode?.trim();
  const name = visitor.countryName?.trim();
  if (code && code.length === 2) return code;
  if (name) return name;
  return null;
}

export function countryMatchesRecord(
  recordCountry: string | null | undefined,
  visitor: VisitorCountry | null | undefined,
): boolean {
  const filter = getVisitorCountryFilter(visitor);
  if (!filter) return true;
  if (!recordCountry?.trim()) return false;

  const stored = recordCountry.trim().toLowerCase();
  const v = filter.toLowerCase();

  if (stored === v) return true;

  const aliases: Record<string, string[]> = {
    sg: ["sg", "singapore"],
    us: ["us", "usa", "united states", "united states of america"],
    gb: ["gb", "uk", "united kingdom", "great britain"],
    au: ["au", "australia"],
    my: ["my", "malaysia"],
    in: ["in", "india"],
    ph: ["ph", "philippines"],
    id: ["id", "indonesia"],
    th: ["th", "thailand"],
    vn: ["vn", "vietnam"],
    ca: ["ca", "canada"],
    jp: ["jp", "japan"],
    cn: ["cn", "china"],
    hk: ["hk", "hong kong"],
    nz: ["nz", "new zealand"],
  };

  const expand = (key: string) => aliases[key] ?? [key];

  const storedKeys = Object.keys(aliases).filter((k) => expand(k).includes(stored));
  const visitorKeys = Object.keys(aliases).filter((k) => expand(k).includes(v));

  if (storedKeys.length && visitorKeys.length) {
    return storedKeys.some((sk) => visitorKeys.includes(sk));
  }

  if (v.length === 2 && stored.includes(v)) return true;
  if (stored.length === 2 && v.includes(stored)) return true;

  return stored.includes(v) || v.includes(stored);
}

export function filterByOwnerCountry<T extends { owner_country?: string | null }>(
  rows: T[],
  visitor: VisitorCountry | null | undefined,
): T[] {
  const filter = getVisitorCountryFilter(visitor);
  if (!filter) return rows;
  return rows.filter((row) => countryMatchesRecord(row.owner_country, visitor));
}
