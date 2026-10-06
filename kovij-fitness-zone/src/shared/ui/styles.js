import { cn } from "../lib/cn";

/**
 * Class recipes shared by several components (kept out of component files for fast refresh).
 * Hover, focus and pressed feedback come from `state-layer` (index.css), so variants only set
 * their container and content colours.
 */

export const BUTTON_VARIANTS = {
  /** Filled: the one main action in a view. */
  primary: "bg-brand text-on-brand font-semibold",
  /** Outlined: secondary actions. */
  secondary: "bg-surface text-ink border border-line-strong font-semibold",
  /** Tonal: secondary actions that should still read as a button. */
  quiet: "bg-surface-2 text-ink font-semibold",
  /** Text: low emphasis (Cancel, inline actions). */
  ghost: "text-ink-2 hover:text-ink font-semibold",
  danger: "bg-bad text-on-bad font-semibold",
  /** For use on the inverted hero card. */
  inverse: "bg-hero-ink text-hero font-semibold",
};

/** Visible heights 32 / 40 / 48 px; every size taps as at least 48 px on touch screens. */
const BUTTON_SIZES = {
  sm: "h-8 min-w-16 px-3 text-body-sm gap-1.5",
  md: "h-10 min-w-16 px-4 text-sm gap-2",
  lg: "h-12 min-w-20 px-6 text-body-lg gap-2",
};

/** Icon size inside a button of each size. */
export const BUTTON_ICON = { sm: "size-4", md: "size-[18px]", lg: "size-5" };

/** Shared by <Button> and <ButtonLink> so links styled as buttons look identical. */
export function buttonClasses({ variant = "secondary", size = "md", block = false, className } = {}) {
  return cn(
    "state-layer touch-target inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full select-none transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-40 aria-disabled:pointer-events-none aria-disabled:opacity-40",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    block && "w-full",
    className
  );
}

/** Round icon buttons: 32 / 40 / 48 px with 18 / 20 / 24 px icons. */
export const ICON_BUTTON_SIZES = {
  sm: { box: "size-8", icon: "size-[18px]" },
  md: { box: "size-10", icon: "size-5" },
  lg: { box: "size-12", icon: "size-6" },
};

/**
 * Text fields and selects. 16 px text on phones (smaller makes iPhones zoom in on focus),
 * 14 px from the expanded breakpoint. Outline is 3:1 against the surface (WCAG 1.4.11).
 */
export const controlClasses = cn(
  "w-full rounded-control border border-control bg-surface text-base text-ink md:text-sm",
  "placeholder:text-ink-3 transition-colors duration-150",
  "hover:border-ink-3 focus:border-focus focus:outline-none focus-visible:outline-none focus:ring-2 focus:ring-focus/25",
  "aria-[invalid=true]:border-bad aria-[invalid=true]:focus:ring-bad/25",
  "disabled:cursor-not-allowed disabled:bg-surface-2 disabled:text-ink-3"
);

/** Field heights: 44 px on phones (thumb-friendly), 40 px from the expanded breakpoint. */
export const CONTROL_HEIGHT = "h-11 md:h-10";

/** Material filter/choice chip: 32 px (48 px to tap), 8 px corners; chosen = soft brand fill. */
export function chipClasses(selected, className) {
  return cn(
    "state-layer touch-target inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-chip border px-3 text-body-sm font-semibold transition-colors duration-150",
    "disabled:pointer-events-none disabled:opacity-40",
    selected ? "border-transparent bg-brand-soft text-brand-ink" : "border-line-strong bg-surface text-ink-2",
    className
  );
}

/**
 * Save/submit bar pinned to the bottom of long staff forms: just above the phone navigation
 * bar, and beside the rail from 600 px. Pair with bottom padding on the form (pb-24).
 */
export const stickyActionBarClasses = cn(
  "fixed inset-x-0 bottom-[calc(var(--kv-navbar-h)+env(safe-area-inset-bottom))] z-30 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur-md",
  "sm:bottom-0 sm:left-[calc(5rem+env(safe-area-inset-left))] sm:px-6 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] xl:left-[calc(var(--kv-rail-w)+env(safe-area-inset-left))]"
);
