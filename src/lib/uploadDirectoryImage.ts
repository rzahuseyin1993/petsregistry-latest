/**
 * Upload a compressed image to the cPanel storage server (business-listings bucket).
 * Images are resized to max 1200px, converted to WebP, and kept under 400KB.
 * Returns the public URL.
 */
import { resizeImage, uploadRaw } from "@/lib/imageUpload";

const BUCKET = "business-listings";

export const uploadDirectoryImage = async (
  file: File,
  folder: string,
): Promise<string> => {
  const compressed = await resizeImage(file);
  const filename = `${Date.now()}.webp`;
  const path = `${folder}/${filename}`;

  return uploadRaw({
    bucket: BUCKET,
    path,
    body: compressed,
    contentType: "image/webp",
    upsert: true,
  });
};
