/**
 * Shared form validation helpers.
 * Each validator returns an error message string, or null when the value is valid.
 */

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
// Digits, spaces, dashes, parentheses, optional leading +; 7-20 digits total.
export const PHONE_REGEX = /^\+?[\d\s\-()]{7,20}$/;

export const todayStr = () => {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function validateRequired(value: string, label: string, opts?: { min?: number; max?: number }): string | null {
  const v = value.trim();
  if (!v) return `${label} is required.`;
  if (opts?.min && v.length < opts.min) return `${label} must be at least ${opts.min} characters.`;
  if (opts?.max && v.length > opts.max) return `${label} must be at most ${opts.max} characters.`;
  return null;
}

export function validateOptionalLength(value: string, label: string, max: number): string | null {
  if (value && value.trim().length > max) return `${label} must be at most ${max} characters.`;
  return null;
}

export function validateEmail(value: string, opts?: { required?: boolean; label?: string }): string | null {
  const label = opts?.label ?? "Email";
  const v = value.trim();
  if (!v) return opts?.required ? `${label} is required.` : null;
  if (!EMAIL_REGEX.test(v)) return `Please enter a valid ${label.toLowerCase()} address.`;
  if (v.length > 254) return `${label} is too long.`;
  return null;
}

export function validatePhone(value: string, opts?: { required?: boolean; label?: string }): string | null {
  const label = opts?.label ?? "Phone number";
  const v = value.trim();
  if (!v) return opts?.required ? `${label} is required.` : null;
  if (!PHONE_REGEX.test(v)) return `Please enter a valid ${label.toLowerCase()} (7-20 digits).`;
  return null;
}

export function validateNumberRange(
  value: string | number,
  label: string,
  opts: { min?: number; max?: number; required?: boolean; integer?: boolean },
): string | null {
  const raw = typeof value === "number" ? String(value) : value.trim();
  if (!raw) return opts.required ? `${label} is required.` : null;
  const n = Number(raw);
  if (Number.isNaN(n) || !Number.isFinite(n)) return `${label} must be a valid number.`;
  if (opts.integer && !Number.isInteger(n)) return `${label} must be a whole number.`;
  if (opts.min !== undefined && n < opts.min) return `${label} must be at least ${opts.min}.`;
  if (opts.max !== undefined && n > opts.max) return `${label} must be at most ${opts.max}.`;
  return null;
}

export function validateDateNotFuture(value: string, label: string, opts?: { required?: boolean }): string | null {
  const v = value.trim();
  if (!v) return opts?.required ? `${label} is required.` : null;
  if (Number.isNaN(new Date(v).getTime())) return `${label} is not a valid date.`;
  if (v > todayStr()) return `${label} cannot be in the future.`;
  return null;
}

export function validateUrl(value: string, opts?: { required?: boolean; label?: string }): string | null {
  const label = opts?.label ?? "URL";
  const v = value.trim();
  if (!v) return opts?.required ? `${label} is required.` : null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!url.hostname.includes(".")) return `Please enter a valid ${label.toLowerCase()}.`;
    return null;
  } catch {
    return `Please enter a valid ${label.toLowerCase()}.`;
  }
}

export function validateImageFile(
  file: File,
  opts?: { maxMb?: number; label?: string },
): string | null {
  const label = opts?.label ?? "Image";
  const maxMb = opts?.maxMb ?? 8;
  if (!file.type.startsWith("image/")) return `${label} must be an image file.`;
  if (file.size > maxMb * 1024 * 1024) return `${label} must be smaller than ${maxMb} MB.`;
  return null;
}

/** Runs validators in order and returns the first error found, or null when all pass. */
export function firstError(...results: (string | null)[]): string | null {
  for (const r of results) if (r) return r;
  return null;
}
