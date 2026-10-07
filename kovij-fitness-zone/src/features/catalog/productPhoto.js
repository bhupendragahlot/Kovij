/**
 * Shrink a product photo in the browser before upload: keeps its shape, longest side at most
 * 800 px, as JPEG on white (product shots are often PNGs with transparency). Phone photos of
 * 4–12 MB become ~100 KB. The server still checks it's a real image.
 */
const MAX = 800;

export async function prepareProductPhoto(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error("Choose a JPEG, PNG or WebP photo.");
  let img;
  try {
    img = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("This photo can’t be opened here. Try a JPEG or PNG.");
  }
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  img.close?.();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) throw new Error("This photo couldn’t be prepared. Try another one.");
  return new File([blob], "product.jpg", { type: "image/jpeg" });
}
