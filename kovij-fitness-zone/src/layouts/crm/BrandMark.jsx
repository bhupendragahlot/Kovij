import { cn } from "../../shared/lib/cn";

/**
 * The Kovij mark: slanted K on a tile with the top-right corner cut. Same geometry as the brand kit
 * (public/brand/kovij-mark.svg) and the icons (scripts/generate-icons.mjs); in the app's own colours.
 */
export function KMark({ className }) {
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <path d="M0 0H76L100 24V100H0Z" fill="var(--kv-brand)" />
      <path
        d="M28.11 21H46.11L35.89 79H17.89ZM41.88 45L67.61 21H88.11L37.91 67.5ZM46.12 55L78.89 79H57.89L37.91 67.5Z"
        fill="var(--kv-on-brand)"
      />
    </svg>
  );
}

/** The gym's own logo (Settings) replaces the K mark once one is uploaded. */
export function BrandMark({ tone = "rail", compact = false, logoUrl, className }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      {logoUrl ? <img src={logoUrl} alt="" className="size-9 shrink-0 rounded-[9px] bg-white object-contain p-0.5" /> : <KMark className="size-9 shrink-0" />}
      {!compact && (
        <span className="leading-tight">
          <span className={cn("block text-[17px] font-extrabold tracking-[-0.02em]", tone === "rail" ? "text-rail-ink" : "text-ink")}>Kovij</span>
          <span className={cn("block text-xs font-medium", tone === "rail" ? "text-rail-ink-2" : "text-ink-3")}>Front desk</span>
        </span>
      )}
    </span>
  );
}
