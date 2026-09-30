/**
 * Turn a phone photo (often 4–12 MB) into a small square JPEG for a profile picture, in the browser,
 * so uploads are quick on the gym's connection and stay far below the 5 MB server limit.
 */
const OUTPUT = 512;

async function decode(file) {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> (older Safari, some formats) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Square crop (biased upwards on tall photos, where the face usually is), resized to 512 px.
 * @param {Blob} file  image from the camera or a file picker
 * @returns {Promise<File>} JPEG
 */
export async function preparePhoto(file, { size = OUTPUT, quality = 0.85 } = {}) {
  if (!file || !String(file.type || "").startsWith("image/")) {
    throw new Error("Choose a photo (JPEG, PNG or WebP).");
  }
  let source;
  try {
    source = await decode(file);
  } catch {
    throw new Error("This photo can't be opened here. Take a new one, or choose a JPEG or PNG.");
  }
  const w = source.naturalWidth || source.width;
  const h = source.naturalHeight || source.height;
  const side = Math.min(w, h);
  const sx = (w - side) / 2;
  const sy = h > w ? (h - side) * 0.25 : (h - side) / 2;
  const out = Math.min(size, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, sx, sy, side, side, 0, 0, out, out);
  source.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("Couldn't process this photo. Try another one.");
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}

/** Grab the current frame of a <video> (live camera) as a JPEG. */
export function captureFrame(video, quality = 0.9) {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video, 0, 0);
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(new File([blob], "camera.jpg", { type: "image/jpeg" })) : reject(new Error("Couldn't take the photo. Try again."))), "image/jpeg", quality)
  );
}
