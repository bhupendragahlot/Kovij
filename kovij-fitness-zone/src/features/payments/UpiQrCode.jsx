import { useMemo } from "react";
import QRCode from "qrcode";
import { cn } from "../../shared/lib/cn";

/**
 * QR code drawn as SVG from the module matrix, so it is sharp at any size and needs no canvas.
 * Always dark-on-white (in dark mode too): phone cameras read that reliably.
 */
export function QrCode({ value, label, className }) {
  const path = useMemo(() => {
    if (!value) return null;
    const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
    const n = modules.size;
    let d = "";
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) if (modules.get(y, x)) d += `M${x + 4} ${y + 4}h1v1h-1z`;
    }
    return { d, size: n + 8 };
  }, [value]);

  if (!path) return null;
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox={`0 0 ${path.size} ${path.size}`}
      shapeRendering="crispEdges"
      className={cn("block rounded-tile bg-white text-black", className)}
    >
      <path d={path.d} fill="currentColor" />
    </svg>
  );
}
