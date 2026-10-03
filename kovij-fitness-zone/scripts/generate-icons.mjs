/**
 * Generates the favicon and app icons from the Kovij mark (public/brand/kovij-mark.svg): a slanted
 * white "K" on a red tile with the top-right corner cut. Pure Node: a small supersampled
 * rasteriser + PNG/ICO encoders, no image libraries.
 *
 *   node scripts/generate-icons.mjs
 *
 * Writes public/favicon.ico (16/32/48), public/icons/icon.svg, icon-192.png, icon-512.png,
 * icon-maskable-512.png, apple-touch-icon.png and badge-96.png (push notification badge).
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const OUT = join(PUBLIC, "icons");
const RED = [0xd3, 0x2f, 0x2f];
const WHITE = [0xff, 0xff, 0xff];

// ── Geometry (100 × 100), identical to public/brand/kovij-mark.svg ────────────
const SLANT = Math.tan((10 * Math.PI) / 180);
const slant = ([x, y]) => [x + (50 - y) * SLANT, y];
const TILE = [[0, 0], [76, 0], [100, 24], [100, 100], [0, 100]];
const K_SHAPES = [
  [[23, 21], [41, 21], [41, 79], [23, 79]],
  [[41, 45], [62.5, 21], [83, 21], [41, 67.5]],
  [[47, 55], [84, 79], [63, 79], [41, 67.5]],
].map((shape) => shape.map(slant));

const K_BOX = (() => {
  const pts = K_SHAPES.flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x1: Math.min(...xs), x2: Math.max(...xs), y1: Math.min(...ys), y2: Math.max(...ys) };
})();

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * @param {number} px output size
 * @param {"mark"|"fullBleed"|"badge"} style  mark: the cut-corner tile on transparent; fullBleed: red
 *        square edge to edge (maskable / Apple), the K centred at `kScale` of the canvas height;
 *        badge: the white K alone on transparent (Android draws notification badges from alpha only)
 */
function render(px, { style, padding = 0, kScale = 0.56 }) {
  const data = Buffer.alloc(px * px * 4);
  const SS = 4;
  // Map pixels to mark units.
  let toMark;
  if (style === "mark") {
    const unit = (px * (1 - 2 * padding)) / 100;
    const off = px * padding;
    toMark = (fx, fy) => [(fx - off) / unit, (fy - off) / unit];
  } else {
    const kH = K_BOX.y2 - K_BOX.y1;
    const unit = (px * kScale) / kH;
    const cx = (K_BOX.x1 + K_BOX.x2) / 2;
    const cy = (K_BOX.y1 + K_BOX.y2) / 2;
    toMark = (fx, fy) => [cx + (fx - px / 2) / unit, cy + (fy - px / 2) / unit];
  }
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let bg = 0;
      let k = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const [mx, my] = toMark(x + (sx + 0.5) / SS, y + (sy + 0.5) / SS);
          const inK = K_SHAPES.some((s) => inPolygon(mx, my, s));
          const inBg = style === "badge" ? inK : style === "fullBleed" || inPolygon(mx, my, TILE);
          if (!inBg) continue;
          bg += 1;
          if (inK) k += 1;
        }
      }
      const i = (y * px + x) * 4;
      const kShare = bg ? k / bg : 0;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(RED[c] * (1 - kShare) + WHITE[c] * kShare);
      data[i + 3] = Math.round((255 * bg) / (SS * SS));
    }
  }
  return data;
}

// ── PNG and ICO encoders ──────────────────────────────────────────────────────
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, body) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(body.length);
  const tb = Buffer.concat([Buffer.from(type, "ascii"), body]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(tb));
  return Buffer.concat([len, tb, crc]);
};

function png(px, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((px * 4 + 1) * px);
  for (let y = 0; y < px; y++) {
    raw[y * (px * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (px * 4 + 1) + 1, y * px * 4, (y + 1) * px * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/** ICO with PNG-compressed images (supported by every current browser and Windows). */
function ico(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map(({ px, data }) => {
    const e = Buffer.alloc(16);
    e[0] = px >= 256 ? 0 : px;
    e[1] = px >= 256 ? 0 : px;
    e.writeUInt16LE(1, 4); // planes
    e.writeUInt16LE(32, 6); // bits per pixel
    e.writeUInt32LE(data.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += data.length;
    return e;
  });
  return Buffer.concat([header, ...entries, ...images.map((i) => i.data)]);
}

// ── Output ────────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const ICONS = [
  { file: "icon-192.png", px: 192, style: "mark", padding: 0.04 },
  { file: "icon-512.png", px: 512, style: "mark", padding: 0.04 },
  // Maskable: red edge to edge; the K stays well inside the 80% safe circle.
  { file: "icon-maskable-512.png", px: 512, style: "fullBleed", kScale: 0.5 },
  // iOS fills transparency with black and rounds the corners itself.
  { file: "apple-touch-icon.png", px: 180, style: "fullBleed", kScale: 0.56 },
  // Small monochrome icon in the Android status bar for push notifications.
  { file: "badge-96.png", px: 96, style: "badge", kScale: 0.8 },
];
for (const { file, px, ...opts } of ICONS) {
  writeFileSync(join(OUT, file), png(px, render(px, opts)));
  console.log(`wrote public/icons/${file}`);
}

writeFileSync(join(PUBLIC, "favicon.ico"), ico([16, 32, 48].map((px) => ({ px, data: png(px, render(px, { style: "mark" })) }))));
console.log("wrote public/favicon.ico (16, 32, 48)");

const pts = (shape) => shape.map(([x, y]) => `${Math.round(x * 100) / 100} ${Math.round(y * 100) / 100}`).join("L");
writeFileSync(
  join(OUT, "icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><title>Kovij Fitness Zone</title><path d="M${pts(TILE)}Z" fill="#D32F2F"/><path d="${K_SHAPES.map((s) => `M${pts(s)}Z`).join("")}" fill="#FFFFFF"/></svg>\n`
);
console.log("wrote public/icons/icon.svg");
