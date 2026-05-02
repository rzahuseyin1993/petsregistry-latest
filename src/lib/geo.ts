// Lightweight geo helpers: reverse geocoding + EXIF GPS extraction.
// Uses OpenStreetMap Nominatim (free, no API key). Be polite — single calls only.

import exifr from "exifr";

export type Coords = { lat: number; lng: number };

/**
 * Reverse-geocode latitude/longitude to a human-readable address.
 * Returns null on any failure (network, rate-limit, etc.) — caller should fall back.
 */
export async function reverseGeocode(lat: number, lng: number): Promise<string | null> {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const display = (json?.display_name as string | undefined) || null;
    if (!display) return null;
    // Trim very long results — keep first ~5 components for readability
    const parts = display.split(",").map((p) => p.trim()).filter(Boolean);
    return parts.slice(0, 5).join(", ");
  } catch {
    return null;
  }
}

/**
 * Try to read GPS coordinates from an image file's EXIF metadata.
 * Returns null if the photo has no GPS data or parsing fails.
 */
export async function extractPhotoGps(file: File): Promise<Coords | null> {
  try {
    const data = await exifr.gps(file);
    if (!data || typeof data.latitude !== "number" || typeof data.longitude !== "number") return null;
    return { lat: data.latitude, lng: data.longitude };
  } catch {
    return null;
  }
}

/**
 * Format a coords pair into a short fallback string (used when reverse-geocoding fails).
 */
export function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}
