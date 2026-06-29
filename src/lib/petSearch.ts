/** True when the query looks like a pet ID, UUID, or microchip — search worldwide, not by visitor country. */
export function isIdentifierPetQuery(query: string): boolean {
  const t = query.trim();
  if (!t) return false;
  if (/^PR[-\s]?\d{4}[-\s]?\d+$/i.test(t)) return true;
  if (/^[a-f0-9-]{36}$/i.test(t)) return true;
  const digits = t.replace(/\s/g, "");
  if (/^\d{9,}$/.test(digits)) return true;
  return false;
}

export function normalizePetSearchQuery(query: string): string {
  return query.trim();
}
