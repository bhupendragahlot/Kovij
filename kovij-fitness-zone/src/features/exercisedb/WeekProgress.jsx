import { cn } from "../../shared/lib/cn";

/** "This week: 3 of 8 done" with a bar. */
export function WeekProgress({ done, total, label = "This week", className }) {
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <div className={className}>
      <p className="mb-1 flex justify-between gap-2 text-body-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular text-ink-3">
          {done} of {total} done
        </span>
      </p>
      <div
        role="progressbar"
        aria-label={`${label}: ${done} of ${total} done`}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-3"
      >
        <div className={cn("h-full rounded-full transition-[width] duration-500", pct === 100 ? "bg-good" : "bg-brand")} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
