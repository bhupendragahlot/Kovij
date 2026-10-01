import { cn } from "../../shared/lib/cn";

/** The "K" mark: the same geometry is used for the PWA icons (scripts/generate-icons.mjs). */
export function KMark({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--kv-brand)" />
      <g fill="var(--kv-on-brand)">
        <rect x="8.5" y="8" width="4.6" height="16" rx="1" />
        <path d="M13.1 13.9 19.6 8h5.3L13.1 19.4z" />
        <path d="M15.2 14.9 24.9 24h-5.6l-6.2-5.8z" />
      </g>
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
