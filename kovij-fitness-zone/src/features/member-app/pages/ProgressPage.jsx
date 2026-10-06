import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { LineChart as LineIcon, Plus } from "lucide-react";
import { useAddMeasurement, useProgress } from "../queries";
import { ChartFrame, ChartTooltip } from "../../../shared/ui/charts/ChartFrame";
import { usePrefersReducedMotion } from "../../../shared/hooks/useMediaQuery";
import { Button, Card, CardHeader, EmptyState, ErrorState, Field, FormError, Input, PageHeader, SkeletonList, useToast } from "../../../shared/ui";
import { formatDate, gymDayKey } from "../../../shared/lib/format";

const FIELDS = [
  { key: "weightKg", label: "Weight", unit: "kg", step: "0.1" },
  { key: "waistCm", label: "Waist", unit: "cm", step: "0.5" },
  { key: "bodyFatPct", label: "Body fat", unit: "%", step: "0.1" },
  { key: "chestCm", label: "Chest", unit: "cm", step: "0.5" },
];
const BMI_TEXT = { underweight: "Below the healthy range", healthy: "In the healthy range", normal: "In the healthy range", overweight: "Above the healthy range", obese: "Well above the healthy range" };
const round1 = (n) => Math.round(n * 10) / 10;
const dayLabel = (day) => formatDate(`${day}T12:00:00+05:30`);

function Change({ value, unit }) {
  if (value == null || value === 0) return null;
  return (
    <span className="tabular text-body-sm font-semibold text-ink-3">
      {value > 0 ? "+" : ""}
      {round1(value)} {unit} since you started
    </span>
  );
}

export default function ProgressPage() {
  const progress = useProgress();
  const [adding, setAdding] = useState(false);
  const p = progress.data;

  return (
    <>
      <PageHeader title="Progress" description="Your measurements over time. Only you and the gym’s coaches can see them." />
      {progress.isPending ? (
        <Card><SkeletonList rows={4} /></Card>
      ) : progress.isError ? (
        <Card><ErrorState error={progress.error} onRetry={() => progress.refetch()} /></Card>
      ) : (
        <div className="flex flex-col gap-4">
          {p.summary.entries > 0 && (
            <div className="grid grid-cols-2 gap-3">
              {FIELDS.filter((f) => p.summary.latest[f.key] != null).map((f) => (
                <Card key={f.key} className="p-4">
                  <p className="text-body-sm font-semibold text-ink-3">{f.label}</p>
                  <p className="tabular text-headline-sm font-bold">
                    {round1(p.summary.latest[f.key])} <span className="text-base font-semibold text-ink-3">{f.unit}</span>
                  </p>
                  <Change value={p.summary.change[f.key]} unit={f.unit} />
                </Card>
              ))}
              {p.summary.bmi != null && (
                <Card className="p-4">
                  <p className="text-body-sm font-semibold text-ink-3">BMI</p>
                  <p className="tabular text-headline-sm font-bold">{round1(p.summary.bmi)}</p>
                  <p className="text-body-sm text-ink-3">{BMI_TEXT[p.summary.bmiCategory] || ""}</p>
                </Card>
              )}
            </div>
          )}
          {adding ? <AddEntry onDone={() => setAdding(false)} /> : (
            <Button variant="primary" size="lg" block icon={Plus} onClick={() => setAdding(true)}>
              Add today’s measurements
            </Button>
          )}
          {p.entries.filter((e) => e.weightKg).length > 1 && <WeightChart entries={p.entries} />}
          <Card>
            <CardHeader title="All entries" />
            {!p.entries.length ? (
              <EmptyState compact icon={LineIcon} title="No measurements yet" body="Add your weight now and again every couple of weeks to see your progress." />
            ) : (
              <ul className="flex flex-col divide-y divide-line">
                {p.entries.map((e) => (
                  <li key={e._id} className="flex flex-wrap items-baseline justify-between gap-2 py-2.5 first:pt-0">
                    <span className="font-semibold">{dayLabel(e.day)}</span>
                    <span className="tabular text-sm text-ink-2">
                      {FIELDS.filter((f) => e[f.key] != null)
                        .map((f) => `${f.label} ${round1(e[f.key])} ${f.unit}`)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

function WeightChart({ entries }) {
  const reduceMotion = usePrefersReducedMotion();
  const rows = [...entries].filter((e) => e.weightKg).reverse().map((e) => ({ label: formatDate(`${e.day}T12:00:00+05:30`).replace(/ \d{4}$/, ""), full: dayLabel(e.day), value: e.weightKg }));
  const values = rows.map((r) => r.value);
  return (
    <Card>
      <ChartFrame title="Weight" table={{ caption: "Weight over time", columns: ["Date", "Weight"], rows: rows.map((r) => [r.full, `${r.value} kg`]) }}>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 320, height: 200 }}>
            <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ fontSize: 12, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={16} />
              <YAxis tickLine={false} axisLine={false} width={40} domain={[Math.floor(Math.min(...values) - 1), Math.ceil(Math.max(...values) + 1)]} tick={{ fontSize: 12, fill: "var(--kv-ink-3)" }} />
              <Tooltip content={<ChartTooltip valueFormatter={(v) => `${v} kg`} labelFormatter={(l) => rows.find((r) => r.label === l)?.full || l} />} />
              <Line type="monotone" dataKey="value" name="weight" stroke="var(--kv-chart-1)" strokeWidth={2.5} dot={{ r: 3, fill: "var(--kv-chart-1)" }} isAnimationActive={!reduceMotion} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>
    </Card>
  );
}

function AddEntry({ onDone }) {
  const add = useAddMeasurement();
  const toast = useToast();
  const [form, setForm] = useState({ day: gymDayKey(), weightKg: "", waistCm: "", bodyFatPct: "", chestCm: "" });
  const errors = add.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = { day: form.day, ...Object.fromEntries(FIELDS.filter((f) => form[f.key] !== "").map((f) => [f.key, Number(form[f.key])])) };
    add.mutate(payload, { onSuccess: () => (toast.success("Saved"), onDone()) });
  };

  return (
    <Card>
      <CardHeader title="New measurements" description="Fill in what you measured; leave the rest empty." />
      <form onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <div className="col-span-2">
          <FormError error={Object.keys(errors).length ? null : add.error} />
        </div>
        <Field label="Date" error={errors.day} className="col-span-2">
          <Input type="date" max={gymDayKey()} value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} />
        </Field>
        {FIELDS.map((f) => (
          <Field key={f.key} label={f.label} error={errors[f.key]} optional={f.key !== "weightKg"}>
            <Input type="number" inputMode="decimal" step={f.step} min="0" suffix={f.unit} value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
          </Field>
        ))}
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={onDone}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={add.isPending}>
            Save
          </Button>
        </div>
      </form>
    </Card>
  );
}
