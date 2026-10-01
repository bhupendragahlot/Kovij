import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip, LegendItem } from "../../shared/ui/charts/ChartFrame";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { formatMonth, formatNumber } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";
import { DAY_SHORT, hourLabel } from "./labels";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit" };
const INITIAL = { width: 320, height: 200 };
const monthLabel = (key) => `${formatMonth(key)} ${key.slice(2, 4)}`;

/** One series of counts as bars (single series: the title names it, no legend). */
function CountBars({ title, rows, valueName, height = 200, valueFormatter = formatNumber, tableColumns, tableRows, yWidth = 36, maxBarSize = 22 }) {
  const reduceMotion = usePrefersReducedMotion();
  return (
    <ChartFrame title={title} table={{ caption: title, columns: tableColumns, rows: tableRows }}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: 0 }} barCategoryGap="25%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={10} />
            <YAxis tickLine={false} axisLine={false} width={yWidth} allowDecimals={false} tickFormatter={valueFormatter} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip valueFormatter={valueFormatter} labelFormatter={(l) => rows.find((r) => r.label === l)?.full || l} />} />
            <Bar dataKey="value" name={valueName} fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={maxBarSize} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

export function JoinsChart({ data }) {
  const rows = data.map((d) => ({ label: formatMonth(d.month), full: monthLabel(d.month), value: d.joined }));
  return (
    <CountBars
      title="New members per month"
      valueName="joined"
      rows={rows}
      tableColumns={["Month", "New members"]}
      tableRows={rows.map((r) => [r.full, formatNumber(r.value)])}
    />
  );
}

/** Renewal rate per month; months with no decided plans have no bar (and say so in the table). */
export function RenewalTrendChart({ data }) {
  const rows = data.map((d) => ({ label: formatMonth(d.month), full: monthLabel(d.month), value: d.rate, ended: d.ended }));
  return (
    <CountBars
      title="Renewal rate by month a plan ended"
      valueName="renewed"
      rows={rows}
      valueFormatter={(v) => `${v}%`}
      yWidth={44}
      tableColumns={["Month", "Plans ended", "Renewed"]}
      tableRows={rows.map((r) => [r.full, formatNumber(r.ended), r.value == null ? "Not known yet" : `${r.value}%`])}
    />
  );
}

const shortDay = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/** Visits per day (or per month for long periods), zero days filled in. */
export function VisitsChart({ byDay, from, to }) {
  const counts = Object.fromEntries(byDay.map((d) => [d.day, d.visits]));
  const days = [];
  for (let d = new Date(`${from}T00:00:00Z`); d <= new Date(`${to}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) days.push(d.toISOString().slice(0, 10));
  const monthly = days.length > 62;
  let rows;
  if (monthly) {
    const byMonth = {};
    for (const day of days) byMonth[day.slice(0, 7)] = (byMonth[day.slice(0, 7)] || 0) + (counts[day] || 0);
    rows = Object.entries(byMonth).map(([m, v]) => ({ label: formatMonth(m), full: monthLabel(m), value: v }));
  } else {
    rows = days.map((day) => ({ label: String(Number(day.slice(8))), full: shortDay.format(new Date(`${day}T00:00:00Z`)), value: counts[day] || 0 }));
  }
  return (
    <CountBars
      title={monthly ? "Visits per month" : "Visits per day"}
      valueName="visits"
      rows={rows}
      maxBarSize={monthly ? 24 : 14}
      tableColumns={[monthly ? "Month" : "Day", "Visits"]}
      tableRows={rows.filter((r) => r.value > 0).map((r) => [r.full, formatNumber(r.value)])}
    />
  );
}


/**
 * When the gym is busy: weekday × hour, shaded by visits. Only hours with any visits (plus a
 * margin) are shown, so a 6 am–10 pm gym isn't squeezed into 24 columns on a phone.
 */
export function BusyHeatmap({ grid }) {
  const max = Math.max(1, ...grid.flat());
  const used = grid.flatMap((row) => row.map((v, h) => (v ? h : null))).filter((h) => h != null);
  const first = used.length ? Math.max(0, Math.min(...used) - 1) : 5;
  const last = used.length ? Math.min(23, Math.max(...used) + 1) : 22;
  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const slots = grid
    .flatMap((row, d) => row.map((v, h) => ({ d, h, v })))
    .filter((s) => s.v > 0)
    .sort((a, b) => b.v - a.v)
    .slice(0, 12);

  return (
    <ChartFrame
      title="Busy times"
      legend={
        <>
          <LegendItem color="color-mix(in oklab, var(--kv-chart-1) 20%, transparent)">Quiet</LegendItem>
          <LegendItem color="var(--kv-chart-1)">Busiest</LegendItem>
        </>
      }
      table={{ caption: "Busiest times", columns: ["Time", "Visits"], rows: slots.map((s) => [`${DAY_SHORT[s.d]} ${hourLabel(s.h)}m`, formatNumber(s.v)]) }}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[20rem] border-separate border-spacing-[3px] text-[11px]" aria-hidden>
          <thead>
            <tr>
              <th className="w-9" />
              {hours.map((h) => (
                <th key={h} className="font-medium text-ink-3">
                  {h % 3 === 0 ? hourLabel(h) : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, d) => (
              <tr key={d}>
                <th className="pr-1 text-left font-medium text-ink-3">{DAY_SHORT[d]}</th>
                {hours.map((h) => {
                  const v = row[h];
                  return (
                    <td
                      key={h}
                      title={`${DAY_SHORT[d]} ${hourLabel(h)}m: ${v} ${v === 1 ? "visit" : "visits"}`}
                      className={cn("h-6 rounded-[4px]", !v && "bg-surface-2")}
                      style={v ? { background: `color-mix(in oklab, var(--kv-chart-1) ${Math.round(20 + (v / max) * 80)}%, transparent)` } : undefined}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartFrame>
  );
}
