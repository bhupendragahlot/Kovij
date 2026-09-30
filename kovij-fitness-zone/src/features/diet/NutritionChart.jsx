import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip, LegendItem } from "../../shared/ui/charts/ChartFrame";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { formatNumber, formatShortDate } from "../../shared/lib/format";
import { formatKcal, shiftDayKey } from "./labels";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit", fill: "var(--kv-ink-3)" };
const INITIAL = { width: 320, height: 200 };

/**
 * Calories eaten per day (bars) against the plan's target (line), oldest day on the left.
 * Every day in the range gets a slot so gaps read as "nothing logged", not as squeezed time.
 */
export function NutritionChart({ history }) {
  const reduceMotion = usePrefersReducedMotion();
  const byDay = new Map(history.days.map((d) => [d.day, d]));
  const rows = [];
  let day = history.from;
  for (let i = 0; i < 120; i += 1) {
    const d = byDay.get(day);
    rows.push({
      day,
      label: formatShortDate(`${day}T12:00:00+05:30`),
      eaten: d?.logged ? d.eaten.calories : null,
      target: d?.targets?.calories ?? null,
      meals: d ? `${d.mealsEaten} of ${d.mealsPlanned}` : "",
    });
    if (day === history.to) break;
    day = shiftDayKey(day, 1);
  }
  const hasTarget = rows.some((r) => r.target);

  return (
    <ChartFrame
      title="Calories eaten"
      legend={
        hasTarget && (
          <>
            <LegendItem color="var(--kv-chart-1)">Eaten</LegendItem>
            <LegendItem color="var(--kv-chart-muted)" shape="line">
              Target
            </LegendItem>
          </>
        )
      }
      table={{
        caption: "Calories eaten per day against the target",
        columns: ["Day", "Eaten", "Target", "Planned meals eaten"],
        rows: [...rows].reverse().map((r) => [r.label, r.eaten == null ? "Not logged" : formatKcal(r.eaten), r.target ? formatKcal(r.target) : "None", r.meals || "No plan"]),
      }}
    >
      <div className="h-52">
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barCategoryGap="24%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} width={44} tick={AXIS_TICK} tickFormatter={(v) => formatNumber(v)} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip valueFormatter={(v) => (v == null ? "Not logged" : formatKcal(v))} />} />
            <Bar dataKey="eaten" name="Eaten" fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={!reduceMotion} />
            {hasTarget && (
              <Line dataKey="target" name="Target" type="stepAfter" stroke="var(--kv-chart-muted)" strokeWidth={2} dot={false} activeDot={false} connectNulls={false} isAnimationActive={!reduceMotion} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}
