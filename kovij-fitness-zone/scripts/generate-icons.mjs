/**
 * Generates the PWA icons in public/icons from the "K" mark geometry (same as BrandMark.jsx).
 * Pure Node: a tiny supersampled rasteriser + PNG encoder, no image libraries needed.
 *
 *   node scripts/generate-icons.mjs
 */
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const BRAND = [0xff, 0x7a, 0x1a, 255];
const INK = [0x1f, 0x10, 0x03, 255];

// Mark geometry in a 32×32 box.
const K_SHAPES = [
  [[8.5, 8], [13.1, 8], [13.1, 24], [8.5, 24]],
  [[13.1, 13.9], [19.6, 8], [24.9, 8], [13.1, 19.4]],
  [[15.2, 14.9], [24.9, 24], [19.3, 24], [13.1, 18.2]],
];

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function inRoundedRect(x, y, size, r) {
  if (x < 0 || y < 0 || x > size || y > size) return false;
  const cx = x < r ? r : x > size - r ? size - r : x;
  const cy = y < r ? r : y > size - r ? size - r : y;
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

/**
 * @param {number} px      output size in pixels
 * @param {object} opts
 * @param {boolean} opts.fullBleed  square background (maskable / Apple), else rounded tile
 * @param {number} opts.markScale   fraction of the canvas the 32-unit mark occupies
 */
function render(px, { fullBleed, markScale }) {
  const data = Buffer.alloc(px * px * 4);
  const SS = 4; // 4×4 supersampling
  const unit = (px * markScale) / 32; // pixels per mark unit
  const offset = (px - 32 * unit) / 2;
  for (let y = 0; y < px; y++) {
    for (let x = 0; x < px; x++) {
      let bg = 0;
      let ink = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const fx = x + (sx + 0.5) / SS;
          const fy = y + (sy + 0.5) / SS;
          const inBg = fullBleed ? true : inRoundedRect(fx, fy, px, (px * 9) / 32);
          if (!inBg) continue;
          bg += 1;
          const mx = (fx - offset) / unit;
          const my = (fy - offset) / unit;
          if (K_SHAPES.some((s) => inPolygon(mx, my, s))) ink += 1;
        }
      }
      const total = SS * SS;
      const i = (y * px + x) * 4;
      const inkT = ink / total;
      const bgT = bg / total;
      for (let c = 0; c < 3; c++) data[i + c] = Math.round(BRAND[c] * (1 - inkT / Math.max(bgT, 1e-9)) + INK[c] * (inkT / Math.max(bgT, 1e-9)));
      data[i + 3] = Math.round(255 * bgT);
    }
  }
  return data;
}

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

mkdirSync(OUT, { recursive: true });
const ICONS = [
  { file: "icon-192.png", px: 192, fullBleed: false, markScale: 1 },
  { file: "icon-512.png", px: 512, fullBleed: false, markScale: 1 },
  // Maskable: full-bleed background, mark kept inside the 80% safe zone.
  { file: "icon-maskable-512.png", px: 512, fullBleed: true, markScale: 0.78 },
  { file: "apple-touch-icon.png", px: 180, fullBleed: true, markScale: 0.9 },
];
for (const { file, px, ...opts } of ICONS) {
  writeFileSync(join(OUT, file), png(px, render(px, opts)));
  console.log(`wrote public/icons/${file}`);
}
