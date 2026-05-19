/**
 * Centralised file-upload utility.
 * ─────────────────────────────────
 * All uploads go through this file. Currently configured to POST files
 * to a PHP script on cPanel (petsregistry.org/upload.php).
 *
 * The Supabase SDK is NO LONGER used for storage — only for the database.
 */
import { supabase } from "@/integrations/supabase/client";

/* ── Upload endpoint ────────────────────────────────────────────────── */
const UPLOAD_ENDPOINT = "https://petsregistry.org/upload.php";
const UPLOAD_TOKEN = import.meta.env.VITE_UPLOAD_TOKEN ?? "";

/* ── Compression settings ───────────────────────────────────────────── */
const MAX_DIMENSION = 1200; // px – longest side
const INITIAL_QUALITY = 0.8; // 80%
const MAX_FILE_SIZE = 400 * 1024; // 400 KB

/**
 * Compress an image to WebP, max 1200×1200, ≤400 KB.
 * Iteratively lowers quality if the result exceeds the size limit.
 */
export const resizeImage = (file: File, maxSize = MAX_DIMENSION): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      let { width, height } = img;

      // Scale down if larger than maxSize, keeping aspect ratio
      if (width > maxSize || height > maxSize) {
        if (width > height) {
          height = Math.round((height * maxSize) / width);
          width = maxSize;
        } else {
          width = Math.round((width * maxSize) / height);
          height = maxSize;
        }
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas not supported"));
      ctx.drawImage(img, 0, 0, width, height);

      // Iteratively compress until ≤ MAX_FILE_SIZE or quality floor
      const tryCompress = (quality: number) => {
        canvas.toBlob(
          (blob) => {
            if (!blob) return reject(new Error("Failed to create blob"));
            if (blob.size <= MAX_FILE_SIZE || quality <= 0.3) {
              resolve(blob);
            } else {
              tryCompress(quality - 0.1);
            }
          },
          "image/webp",
          quality,
        );
      };
      tryCompress(INITIAL_QUALITY);
    };
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = url;
  });
};

/* ── Low-level upload (Blob / File  →  public URL) ──────────────────── */

interface UploadRawOptions {
  /** Storage bucket / folder category (e.g. "pet-photos") */
  bucket: string;
  /** Path inside the bucket (e.g. "userId/petId/0.webp") */
  path: string;
  /** The binary payload */
  body: Blob | File;
  /** MIME type (optional, auto-detected) */
  contentType?: string;
  /** Overwrite existing file at the same path */
  upsert?: boolean;
}

/**
 * Upload a raw Blob / File to the cPanel server and return its public URL.
 */
export const uploadRaw = async ({
  bucket,
  path,
  body,
  upsert = false,
}: UploadRawOptions): Promise<string> => {
  const formData = new FormData();
  formData.append("file", body, path.split("/").pop() || "file");
  formData.append("bucket", bucket);
  formData.append("path", path);
  formData.append("upsert", String(upsert));

  const uploadToSupabaseStorage = async () => {
    const { error } = await supabase.storage.from(bucket).upload(path, body, {
      contentType: "type" in body ? body.type : undefined,
      upsert,
    });
    if (error) {
      throw new Error(error.message || "Upload failed");
    }
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    if (!data?.publicUrl) {
      throw new Error("Upload succeeded but URL could not be generated");
    }
    return data.publicUrl;
  };

  // Primary path: cPanel upload.php endpoint.
  // Fallback path: Supabase Storage if token/endpoint is misconfigured.
  try {
    const headers: Record<string, string> = {};
    if (UPLOAD_TOKEN) {
      headers.Authorization = `Bearer ${UPLOAD_TOKEN}`;
    }

    const res = await fetch(UPLOAD_ENDPOINT, {
      method: "POST",
      headers,
      body: formData,
    });

    if (res.ok) {
      const { publicUrl } = await res.json();
      return publicUrl;
    }

    const err = await res.json().catch(() => ({ error: res.statusText }));
    const uploadErr = new Error(err.error || `Upload failed (${res.status})`);

    if (res.status === 401 || res.status === 404 || !UPLOAD_TOKEN) {
      return uploadToSupabaseStorage();
    }

    throw uploadErr;
  } catch {
    return uploadToSupabaseStorage();
  }
};

/* ── High-level: compress image then upload ─────────────────────────── */

/**
 * Compress an image to WebP (≤1200px, ≤400KB) and upload it.
 * Returns the public URL.
 */
export const uploadImage = async (
  file: File,
  bucket: string,
  folder: string,
): Promise<string> => {
  const resized = await resizeImage(file);
  const path = `${folder}/${Date.now()}.webp`;
  return uploadRaw({ bucket, path, body: resized, contentType: "image/webp", upsert: true });
};

/* ── High-level: upload any file as-is (no resize) ─────────────────── */

interface UploadFileOptions {
  /** Storage bucket */
  bucket: string;
  /** Path prefix (e.g. "admin" or "user-id/listing-id") */
  folder: string;
  /** The file to upload */
  file: File | Blob;
  /** Optional filename override */
  filename?: string;
  /** Overwrite existing? */
  upsert?: boolean;
}

/**
 * Upload a file without any transformation.  Returns the public URL.
 */
export const uploadFile = async ({
  bucket,
  folder,
  file,
  filename,
  upsert = false,
}: UploadFileOptions): Promise<string> => {
  const name =
    filename ??
    `${Date.now()}-${Math.random().toString(36).slice(2)}.${
      file instanceof File ? file.name.split(".").pop() : "bin"
    }`;
  const path = folder ? `${folder}/${name}` : name;
  return uploadRaw({ bucket, path, body: file, upsert });
};

/* ── Helper: remove a file from storage ─────────────────────────────── */

/**
 * Delete one or more files from the cPanel server.
 */
export const removeFile = async (bucket: string, paths: string[]): Promise<void> => {
  await fetch(UPLOAD_ENDPOINT, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${UPLOAD_TOKEN}`,
    },
    body: JSON.stringify({ bucket, paths }),
  });
};
