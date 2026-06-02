/** True when VITE_MAINTENANCE_MODE is explicitly enabled at build time. */
export function isEnvMaintenanceMode(): boolean {
  const raw = import.meta.env.VITE_MAINTENANCE_MODE?.trim().toLowerCase();
  return raw === "true" || raw === "1" || raw === "yes" || raw === "on";
}

export function parseMaintenanceFlag(value: string | null | undefined): boolean | null {
  if (value == null || value.trim() === "") return null;
  const raw = value.trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "yes" || raw === "on") return true;
  if (raw === "false" || raw === "0" || raw === "no" || raw === "off") return false;
  return null;
}

/** DB setting wins when set; otherwise falls back to .env build flag. */
export function resolveMaintenanceMode(dbValue: string | null | undefined): boolean {
  const parsed = parseMaintenanceFlag(dbValue);
  if (parsed !== null) return parsed;
  return isEnvMaintenanceMode();
}
