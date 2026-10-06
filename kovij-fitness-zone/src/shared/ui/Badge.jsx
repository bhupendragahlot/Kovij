import { cn } from "../lib/cn";

const TONES = {
  neutral: "bg-surface-2 text-ink-2",
  brand: "bg-brand-soft text-brand-ink",
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
  info: "bg-info-soft text-info",
};

/**
 * Status pill. Meaning is carried by icon + label, never by colour alone.
 */
export function Badge({ tone = "neutral", icon: Icon, children, className, size = "md" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full font-semibold",
        size === "sm" ? "h-5 px-2 text-label-sm" : "h-6 px-2.5 text-label",
        TONES[tone],
        className
      )}
    >
      {Icon && <Icon className={size === "sm" ? "size-3" : "size-3.5"} aria-hidden strokeWidth={2.4} />}
      {children}
    </span>
  );
}
