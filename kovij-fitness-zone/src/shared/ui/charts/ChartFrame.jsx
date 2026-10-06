import { useState } from "react";
import { ChartColumn, Table2 } from "lucide-react";
import { cn } from "../../lib/cn";

/**
 * Wraps a chart with its accessible twin: a real table of the same numbers, one toggle away.
 * `onHero` switches ink to the inverted hero palette.
 *
 * @param {{ caption: string, columns: string[], rows: (string|number)[][] }} table
 */
export function ChartFrame({ title, legend, table, children, onHero = false, className, actions }) {
  const [asTable, setAsTable] = useState(false);
  const ink2 = onHero ? "text-hero-ink-2" : "text-ink-3";
  return (
    <figure className={cn("m-0", className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1">
          {title && <figcaption className={cn("text-body-lg font-semibold", onHero ? "text-hero-ink" : "text-ink")}>{title}</figcaption>}
          {legend && <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-body-sm", ink2)}>{legend}</ul>}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          <button
            type="button"
            onClick={() => setAsTable((v) => !v)}
            aria-pressed={asTable}
            className={cn(
              "state-layer touch-target inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-body-sm font-semibold",
              onHero ? "text-hero-ink-2 hover:text-hero-ink" : "text-ink-3 hover:text-ink"
            )}
          >
            {asTable ? <ChartColumn className="size-4" aria-hidden /> : <Table2 className="size-4" aria-hidden />}
            {asTable ? "Chart" : "Table"}
          </button>
        </div>
      </div>
      {asTable ? (
        <div className="max-h-64 overflow-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">{table.caption}</caption>
            <thead>
              <tr className={cn("border-b", onHero ? "border-hero-line" : "border-line")}>
                {table.columns.map((c, i) => (
                  <th key={c} scope="col" className={cn("py-2 font-semibold", ink2, i === 0 ? "text-left" : "text-right")}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r) => (
                <tr key={r[0]} className={cn("border-b last:border-0", onHero ? "border-hero-line" : "border-line")}>
                  {r.map((cell, i) => (
                    <td key={i} className={cn("py-1.5 tabular", i === 0 ? "text-left" : "text-right font-semibold")}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        children
      )}
    </figure>
  );
}

/** Legend entry: a rect key for bars, a short line key for lines (mirrors the mark). */
export function LegendItem({ color, shape = "rect", children }) {
  return (
    <li className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className={shape === "line" ? "h-0.5 w-3.5 rounded-full" : "size-2.5 rounded-[3px]"}
        style={{ background: color }}
      />
      {children}
    </li>
  );
}

/** Tooltip body: values lead (strong), series names follow, keyed by a short line of the series colour. */
export function ChartTooltip({ active, payload, label, labelFormatter, valueFormatter = (v) => v, onHero }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={cn("kv-app min-w-36 rounded-[10px] border px-3 py-2 font-ui text-body-sm shadow-pop", onHero ? "border-hero-line bg-hero text-hero-ink" : "border-line bg-surface text-ink")}>
      <p className={cn("mb-1 font-semibold", onHero ? "text-hero-ink-2" : "text-ink-3")}>{labelFormatter ? labelFormatter(label) : label}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex items-center gap-2">
          <span aria-hidden className="h-0.5 w-3 rounded-full" style={{ background: p.color || p.stroke || p.fill }} />
          <span className="tabular font-bold">{valueFormatter(p.value)}</span>
          <span className={onHero ? "text-hero-ink-2" : "text-ink-3"}>{p.name}</span>
        </p>
      ))}
    </div>
  );
}
