import { cn } from "../lib/cn";

/** Class recipes shared by several components (kept out of component files for fast refresh). */

export const BUTTON_VARIANTS = {
  primary: "bg-brand text-on-brand hover:bg-brand-hover font-semibold",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-surface-2 font-semibold",
  quiet: "bg-surface-2 text-ink hover:bg-surface-3 font-semibold",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink font-medium",
  danger: "bg-bad text-on-bad hover:opacity-90 font-semibold",
  /** For use on the inverted hero card. */
  inverse: "bg-hero-ink text-hero hover:opacity-90 font-semibold",
};

const BUTTON_SIZES = {
  sm: "h-9 px-3 text-sm gap-1.5 rounded-[10px]",
  md: "h-11 md:h-10 px-4 text-sm gap-2 rounded-control",
  lg: "h-12 px-5 text-[15px] gap-2 rounded-control",
};

/** Shared by <Button> and <ButtonLink> so links styled as buttons look identical. */
export function buttonClasses({ variant = "secondary", size = "md", block = false, className } = {}) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap select-none transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    block && "w-full",
    className
  );
}

export const controlClasses = cn(
  "w-full rounded-control border border-control bg-surface text-[15px] text-ink md:text-sm",
  "placeholder:text-ink-3 transition-colors duration-150",
  "hover:border-ink-3 focus:border-focus focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-focus/25",
  "aria-[invalid=true]:border-bad aria-[invalid=true]:focus:ring-bad/25",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3"
);
