import { ChevronLeft, ChevronRight } from "lucide-react";
import { currentMonth, monthLabel, shiftMonth } from "./month";
import { Button, IconButton } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatINR } from "../../shared/lib/format";

const TILE_TONES = { neutral: "bg-surface-2", good: "bg-good-soft", bad: "bg-bad-soft", warn: "bg-warn-soft" };

/** Inset figure tile with a tone (one background class, so tones never fight Tile's default). */
export function StatTile({ tone = "neutral", className, children }) {
  return <div className={cn("rounded-tile p-4", TILE_TONES[tone], className)}>{children}</div>;
}

/** Previous / next month with the month named in words; never goes past this month. */
export function MonthPicker({ value, onChange, className }) {
  const now = currentMonth();
  const atLatest = value >= now;
  return (
    <div className={cn("flex items-center gap-1", className)}>
      <IconButton icon={ChevronLeft} label="Previous month" variant="secondary" onClick={() => onChange(shiftMonth(value, -1))} />
      <p className="min-w-40 text-center text-body-lg font-semibold" aria-live="polite">
        {monthLabel(value)}
      </p>
      <IconButton icon={ChevronRight} label="Next month" variant="secondary" disabled={atLatest} onClick={() => onChange(shiftMonth(value, 1))} />
      {value !== now && (
        <Button variant="ghost" size="sm" onClick={() => onChange(now)}>
          This month
        </Button>
      )}
    </div>
  );
}

/**
 * Share of a total as a list of labelled bars (single series, so no legend). It is already a
 * readable list of numbers, so it needs no separate table view.
 *
 * @param {{ key: string, label: string, icon?: any, amount: number, hint?: string }[]} items
 */
export function BreakdownList({ items, total, label, emptyText = "Nothing yet", onSelect }) {
  const sum = total ?? items.reduce((s, i) => s + i.amount, 0);
  const shown = items.filter((i) => i.amount > 0).sort((a, b) => b.amount - a.amount);
  if (!shown.length) return <p className="py-2 text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-3" aria-label={label}>
      {shown.map((i) => {
        const pct = sum > 0 ? Math.round((i.amount / sum) * 100) : 0;
        const Icon = i.icon;
        const body = (
          <>
            <div className="flex items-baseline justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2 font-semibold text-ink">
                {Icon && <Icon className="size-4 shrink-0 text-ink-3" aria-hidden />}
                <span className="truncate">{i.label}</span>
                {i.hint && <span className="shrink-0 font-normal text-ink-3">{i.hint}</span>}
              </span>
              <span className="tabular shrink-0">
                <span className="font-semibold">{formatINR(i.amount)}</span>
                <span className="ml-2 text-ink-3">{pct}%</span>
              </span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div className="h-full rounded-full bg-chart-1" style={{ width: `${Math.max(pct, 1)}%` }} />
            </div>
          </>
        );
        return (
          <li key={i.key}>
            {onSelect ? (
              <button type="button" onClick={() => onSelect(i.key)} className="-mx-2 block w-[calc(100%+1rem)] rounded-tile px-2 py-1 text-left hover:bg-surface-2">
                {body}
              </button>
            ) : (
              body
            )}
          </li>
        );
      })}
    </ul>
  );
}
