import { cn } from "../lib/cn";

/** Padding: 16 px on phones, 20 px from 600 px ("md"), more for feature cards ("lg"). */
const PADDING = { none: "", sm: "p-3 sm:p-4", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" };

/**
 * Surfaces have a radius hierarchy: hero (28px) > card (16px) > tile (12px) = control (12px).
 * Cards are flat (elevation 0): in light mode they separate from the chalk canvas by colour
 * alone; in dark mode by a hairline.
 */
export function Card({ as: Tag = "section", tone = "plain", padding = "md", className, children, ...props }) {
  return (
    <Tag
      className={cn(
        tone === "hero" ? "rounded-hero bg-hero text-hero-ink" : "rounded-card bg-surface text-ink border border-transparent dark:border-line",
        PADDING[padding],
        className
      )}
      {...props}
    >
      {children}
    </Tag>
  );
}

export function CardHeader({ title, description, action, id, className }) {
  return (
    <div className={cn("mb-3 flex items-start justify-between gap-3 sm:mb-4", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-title font-semibold text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-body-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small inset panel inside a card (stat tiles, grouped fields). */
export function Tile({ className, children, ...props }) {
  return (
    <div className={cn("rounded-tile bg-surface-2 p-3 sm:p-4", className)} {...props}>
      {children}
    </div>
  );
}
