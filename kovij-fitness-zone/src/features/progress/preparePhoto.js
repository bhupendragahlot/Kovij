/**
 * Get a phone photo ready to upload: turned the right way up, scaled to at most 1600 px on the
 * long side and re-saved as JPEG. Re-saving drops the camera's hidden data (including location),
 * and keeps uploads small on a slow gym connection.
 */
const MAX_SIDE = 1600;
const QUALITY = 0.85;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", ""];

export async function preparePhoto(file) {
  if (!file) throw new Error("Choose a photo first.");
  if (!ACCEPTED.includes(file.type) && !file.type.startsWith("image/")) throw new Error("Choose a photo (JPEG, PNG or WebP).");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo can't be read on this device. Choose a JPEG or PNG photo.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new Error("Couldn't prepare this photo. Try another one.");
  if (blob.size > 5 * 1024 * 1024) throw new Error("This photo is still larger than 5 MB after resizing. Try another one.");
  return blob;
}
