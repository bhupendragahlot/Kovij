import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn } from "../lib/cn";
import { Skeleton } from "./states";

/**
 * Stat tile: label, value, optional change vs a named period, optional link to act on it.
 * Change colour = direction × whether up is good, always paired with an arrow and words.
 *
 * @param {{ current: number, previous: number, label: string, upIsGood?: boolean }} [delta]
 */
export function KpiTile({ label, value, sub, delta, to, icon: Icon, loading, className }) {
  const Tag = to ? Link : "div";
  let deltaEl = null;
  if (delta && delta.previous != null) {
    const diff = delta.current - delta.previous;
    const pct = delta.previous ? Math.round((diff / delta.previous) * 100) : null;
    const up = diff > 0;
    const flat = diff === 0;
    const good = flat ? null : up === (delta.upIsGood ?? true);
    const Arrow = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
    deltaEl = (
      <p className={cn("mt-1.5 flex items-start gap-1 text-body-sm font-semibold", good == null ? "text-ink-3" : good ? "text-good" : "text-bad")}>
        <Arrow className="mt-[3px] size-3.5 shrink-0" aria-hidden strokeWidth={2.6} />
        <span>
          {flat ? "Same as" : pct != null ? `${up ? "+" : ""}${pct}% vs` : `${up ? "+" : ""}${diff} vs`}{" "}
          <span className="font-medium text-ink-3">{delta.label}</span>
        </span>
      </p>
    );
  }

  return (
    <Tag
      to={to}
      className={cn(
        "group flex flex-col rounded-card border border-transparent bg-surface p-4 sm:p-5 dark:border-line",
        to && "state-layer transition-colors hover:border-line-strong",
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-body-sm font-semibold text-ink-2">{label}</p>
        {Icon && <Icon className="size-4 text-ink-3 transition-colors group-hover:text-brand-ink" aria-hidden />}
      </div>
      {loading ? (
        <Skeleton className="mt-2 h-7 w-24 sm:h-9" />
      ) : (
        <p className="tabular mt-1.5 text-headline-sm font-bold text-ink sm:mt-2 sm:text-display">{value}</p>
      )}
      {sub && !loading && <p className="mt-1 text-body-sm text-ink-3">{sub}</p>}
      {!loading && deltaEl}
    </Tag>
  );
}

/** Progress toward a limit (e.g. days used of a plan). Colour shifts as the end nears. */
export function Meter({ value, max, label, className }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const tone = pct >= 90 ? "bg-bad" : pct >= 75 ? "bg-warn" : "bg-brand";
  return (
    <div className={className}>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={value}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", tone)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
