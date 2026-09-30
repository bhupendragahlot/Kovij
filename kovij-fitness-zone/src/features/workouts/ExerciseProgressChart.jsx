import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { ChartFrame, ChartTooltip } from "../../shared/ui/charts/ChartFrame";
import { formatShortDate } from "../../shared/lib/format";
import { dayKeyDate, formatKg } from "./labels";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit", fill: "var(--kv-ink-3)" };
const INITIAL = { width: 320, height: 200 };

const METRICS = {
  e1rm: { title: "Estimated 1-rep max", column: "Est. 1-rep max", format: (v) => formatKg(v) },
  volumeKg: { title: "Volume per session", column: "Volume", format: (v) => formatKg(v) },
  reps: { title: "Reps per session", column: "Reps", format: (v) => `${v} reps` },
};

/**
 * One exercise over time, one series (so the title names it; no legend). The latest point is
 * labelled through the tooltip and the table view carries every value.
 * @param {'e1rm'|'volumeKg'|'reps'} metric
 */
export function ExerciseProgressChart({ points, metric = "e1rm", name, actions }) {
  const reduceMotion = usePrefersReducedMotion();
  const m = METRICS[metric];
  const rows = points.map((p) => ({ ...p, label: formatShortDate(dayKeyDate(p.dayKey)), value: p[metric] }));
  return (
    <ChartFrame
      title={m.title}
      actions={actions}
      table={{
        caption: `${name}: ${m.title.toLowerCase()} by session`,
        columns: ["Date", "Best set", m.column],
        rows: rows.map((r) => [`${r.label} (${r.dayKey})`, r.bestSet.weightKg ? `${r.bestSet.reps} × ${formatKg(r.bestSet.weightKg)}` : `${r.bestSet.reps} reps`, m.format(r.value)]),
      }}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={24} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={AXIS_TICK} allowDecimals={metric !== "reps"} domain={["auto", "auto"]} />
            <Tooltip cursor={{ stroke: "var(--kv-line-strong)" }} content={<ChartTooltip valueFormatter={m.format} />} />
            <Line
              dataKey="value"
              name={m.column}
              type="monotone"
              stroke="var(--kv-chart-1)"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 0, fill: "var(--kv-chart-1)" }}
              activeDot={{ r: 5, strokeWidth: 2 }}
              isAnimationActive={!reduceMotion}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
