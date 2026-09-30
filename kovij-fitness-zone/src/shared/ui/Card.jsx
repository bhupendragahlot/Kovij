import { cn } from "../lib/cn";

const PADDING = { none: "", sm: "p-4", md: "p-4 sm:p-5", lg: "p-5 sm:p-6" };

/**
 * Surfaces have a radius hierarchy: hero (28px) > card (20px) > tile (14px) > control (12px).
 * In light mode cards separate from the chalk canvas by colour alone; in dark mode by a hairline.
 */
export function Card({ as: Tag = "section", tone = "plain", padding = "md", className, children, ...props }) {
  return (
    <Tag
      className={cn(
        tone === "hero"
          ? "rounded-hero bg-hero text-hero-ink"
          : "rounded-card bg-surface text-ink border border-transparent dark:border-line",
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
    <div className={cn("mb-4 flex items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 id={id} className="text-[15px] font-semibold leading-6 text-ink">
          {title}
        </h2>
        {description && <p className="mt-0.5 text-sm text-ink-3">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

/** Small inset panel inside a card (stat tiles, grouped fields). */
export function Tile({ className, children, ...props }) {
  return (
    <div className={cn("rounded-tile bg-surface-2 p-4", className)} {...props}>
      {children}
    </div>
  );
}
