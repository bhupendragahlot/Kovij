import { Bar, BarChart, CartesianGrid, ComposedChart, LabelList, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "../../hooks/useMediaQuery";
import { formatHour, formatINR, formatINRCompact, formatMonth } from "../../lib/format";
import { ChartFrame, ChartTooltip, LegendItem } from "./ChartFrame";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit" };
/** Size used for the first paint, before the container is measured (avoids a zero-size warning). */
const INITIAL = { width: 320, height: 200 };

/**
 * Check-ins per hour: today's bars (brand) against the typical same-weekday line (muted).
 * Emphasis encoding: one highlighted series, the comparison greyed.
 */
export function HourlyCheckins({ data, onHero = false, className, plotClassName = "h-48" }) {
  const reduceMotion = usePrefersReducedMotion();
  const active = data.filter((d) => d.count > 0 || d.typical > 0).map((d) => d.hour);
  const from = Math.min(5, ...(active.length ? active : [5]));
  const to = Math.max(22, ...(active.length ? active : [22]));
  const rows = data.filter((d) => d.hour >= from && d.hour <= to).map((d) => ({ ...d, label: formatHour(d.hour) }));

  const ink2 = onHero ? "var(--kv-hero-ink-2)" : "var(--kv-ink-3)";
  const grid = onHero ? "var(--kv-hero-line)" : "var(--kv-chart-grid)";
  const bar = onHero ? "var(--kv-brand)" : "var(--kv-chart-1)";
  const typical = onHero ? "var(--kv-hero-ink-2)" : "var(--kv-chart-muted)";

  return (
    <ChartFrame
      onHero={onHero}
      className={className}
      title="Check-ins by hour"
      legend={
        <>
          <LegendItem color={bar}>Today</LegendItem>
          <LegendItem color={typical} shape="line">
            Typical for this weekday
          </LegendItem>
        </>
      }
      table={{
        caption: "Check-ins by hour, today and typical",
        columns: ["Hour", "Today", "Typical"],
        rows: rows.filter((r) => r.count || r.typical).map((r) => [r.label, r.count, r.typical]),
      }}
    >
      <div className={plotClassName}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke={grid} strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: grid }} tick={{ ...AXIS_TICK, fill: ink2 }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ ...AXIS_TICK, fill: ink2 }} />
            <Tooltip
              cursor={{ fill: onHero ? "rgb(255 255 255 / 0.06)" : "var(--kv-surface-2)" }}
              content={<ChartTooltip onHero={onHero} />}
            />
            <Bar dataKey="count" name="Today" fill={bar} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion} />
            <Line dataKey="typical" name="Typical" type="monotone" stroke={typical} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={!reduceMotion} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/**
 * Paid revenue per month. Single series, so the title names it and there is no legend box.
 * Only the latest month carries a direct label; the axis and tooltip carry the rest.
 */
export function MonthlyRevenue({ data, height = 220 }) {
  const reduceMotion = usePrefersReducedMotion();
  const rows = data.map((d, i) => ({ ...d, label: formatMonth(d.month), isLast: i === data.length - 1 }));
  return (
    <ChartFrame
      title="Collected per month"
      table={{
        caption: "Revenue collected per month",
        columns: ["Month", "Collected"],
        rows: rows.map((r) => [r.label, formatINR(r.amount)]),
      }}
    >
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={rows} margin={{ top: 24, right: 4, bottom: 0, left: 0 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <YAxis tickLine={false} axisLine={false} width={52} tickFormatter={formatINRCompact} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip valueFormatter={formatINR} />} />
            <Bar dataKey="amount" name="Collected" fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion}>
              <LabelList
                dataKey="amount"
                position="top"
                content={({ x, y, width, value, index }) =>
                  rows[index]?.isLast ? (
                    <text x={x + width / 2} y={y - 8} textAnchor="middle" fontSize={12} fontWeight={700} fill="var(--kv-ink)">
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
