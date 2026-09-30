import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "../../shared/ui/charts/ChartFrame";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { formatINR, formatINRCompact, formatMonth } from "../../shared/lib/format";
import { dayLabel } from "./month";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit" };
const INITIAL = { width: 320, height: 200 };

/**
 * Money collected per day of one month. Single series (follows shared/ui/charts conventions):
 * the title names it, so there is no legend; thin bars with 4px rounded tops; hairline grid;
 * a table view of the same numbers one tap away.
 */
export function DailyRevenue({ data, title, height = 220 }) {
  const reduceMotion = usePrefersReducedMotion();
  const rows = data.map((d) => ({ ...d, label: String(Number(d.day.slice(8))) }));
  return (
    <ChartFrame
      title={title}
      table={{
        caption: title,
        columns: ["Day", "Collected", "Payments"],
        rows: rows.filter((r) => r.amount > 0).map((r) => [dayLabel(r.day), formatINR(r.amount), r.count]),
      }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="20%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={10} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatINRCompact} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip
              cursor={{ fill: "var(--kv-surface-2)" }}
              content={<ChartTooltip valueFormatter={formatINR} labelFormatter={(label) => dayLabel(rows.find((r) => r.label === label)?.day || rows[0].day)} />}
            />
            <Bar dataKey="amount" name="Collected" fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/**
 * Collected per month over the last year. Same marks as the dashboard chart; the right margin
 * leaves room for the latest month's direct label on narrow phones.
 */
export function MonthlyTrend({ data, height = 220 }) {
  const reduceMotion = usePrefersReducedMotion();
  const rows = data.map((d, i) => ({ ...d, label: formatMonth(d.month), isLast: i === data.length - 1 }));
  return (
    <ChartFrame
      title="Collected per month"
      table={{ caption: "Money collected per month", columns: ["Month", "Collected"], rows: rows.map((r) => [`${r.label} ${r.month.slice(0, 4)}`, formatINR(r.amount)]) }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={rows} margin={{ top: 24, right: 20, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatINRCompact} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip valueFormatter={formatINR} />} />
            <Bar dataKey="amount" name="Collected" fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion}>
              <LabelList
                dataKey="amount"
                position="top"
                content={({ x, y, width, value, index }) =>
                  rows[index]?.isLast ? (
                    <text x={x + width} y={y - 8} textAnchor="end" fontSize={12} fontWeight={700} fill="var(--kv-ink)">
                      {formatINRCompact(value)}
                    </text>
                  ) : null
                }
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
