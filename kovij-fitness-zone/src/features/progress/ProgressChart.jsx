import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartFrame, ChartTooltip } from "../../shared/ui/charts/ChartFrame";
import { SegmentedControl } from "../../shared/ui";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { formatDate, formatNumber, formatShortDate } from "../../shared/lib/format";
import { METRIC, dayToDate, formatMeasure } from "./labels";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit", fill: "var(--kv-ink-3)" };
const INITIAL = { width: 320, height: 200 };
const CHARTABLE = ["weightKg", "bmi", "bodyFatPct", "waistCm"];

/**
 * One measurement over time (weight, BMI, body fat or waist), oldest on the left. One series at
 * a time keeps the scale honest; the table view lists the same numbers.
 */
export function ProgressChart({ entries }) {
  const reduceMotion = usePrefersReducedMotion();
  const available = CHARTABLE.filter((k) => entries.some((e) => e[k] != null));
  const [picked, setPicked] = useState(null);
  const metric = available.includes(picked) ? picked : available[0];
  if (!metric) return null;
  const meta = METRIC[metric];
  const rows = [...entries]
    .filter((e) => e[metric] != null)
    .reverse()
    .map((e) => ({ day: e.day, label: formatShortDate(dayToDate(e.day)), value: e[metric] }));

  return (
    <div className="flex flex-col gap-3">
      {available.length > 1 && (
        <SegmentedControl
          label="Measurement to show"
          size="sm"
          value={metric}
          onChange={setPicked}
          options={available.map((k) => ({ value: k, label: METRIC[k].label }))}
          className="self-start"
        />
      )}
      <ChartFrame
        title={`${meta.label}${meta.unit ? ` (${meta.unit})` : ""}`}
        table={{
          caption: `${meta.label} over time`,
          columns: ["Date", meta.label],
          rows: [...rows].reverse().map((r) => [formatDate(dayToDate(r.day)), formatMeasure(r.value, meta.unit)]),
        }}
      >
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
            <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
              <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" strokeWidth={1} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={18} />
              <YAxis
                tickLine={false}
                axisLine={false}
                width={44}
                tick={AXIS_TICK}
                domain={[(min) => Math.floor(min - 1), (max) => Math.ceil(max + 1)]}
                tickFormatter={(v) => formatNumber(v)}
                allowDecimals={false}
              />
              <Tooltip cursor={{ stroke: "var(--kv-line-strong)" }} content={<ChartTooltip valueFormatter={(v) => formatMeasure(v, meta.unit)} />} />
              <Line
                dataKey="value"
                name={meta.label}
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
      {rows.length === 1 && <p className="text-[13px] text-ink-3">Add another entry to see the trend.</p>}
    </div>
  );
}
