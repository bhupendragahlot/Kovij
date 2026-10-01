/**
 * Shrink a logo in the browser before upload: keeps its shape (logos are often wide) and
 * transparency, longest side at most 512 px, as PNG. The server checks it's a real image.
 */
const MAX = 512;

export async function prepareLogo(file) {
  if (!file || !/^image\/(png|jpeg|webp)$/.test(file.type)) {
    throw new Error("Choose a PNG, JPEG or WebP image. SVG logos aren’t supported yet.");
  }
  let img;
  try {
    img = await createImageBitmap(file);
  } catch {
    throw new Error("This image can’t be opened here. Try saving it as a PNG first.");
  }
  const scale = Math.min(1, MAX / Math.max(img.width, img.height));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  canvas.getContext("2d").drawImage(img, 0, 0, width, height);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("This image couldn’t be prepared. Try another file.");
  return new File([blob], "logo.png", { type: "image/png" });
}
