import { Field, Input, SegmentedControl, Select } from "../../../shared/ui";
import { REST_OPTIONS, formatRest } from "../labels";

/**
 * What to do for one scheduled exercise. `value` comes from prescriptionForm() (prescription.js);
 * `errors` are the server's field messages for this exercise (sets, reps, durationSec…).
 */
export function PrescriptionFields({ value: f, onChange, errors = {}, idPrefix }) {
  const set = (patch) => onChange({ ...f, ...patch });
  return (
    <div className="flex flex-col gap-3">
      <SegmentedControl
        label="Measure by"
        size="sm"
        value={f.mode}
        onChange={(mode) => set({ mode })}
        options={[
          { value: "reps", label: "Sets and reps" },
          { value: "time", label: "Time" },
        ]}
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Field label="Sets" optional={f.mode === "time"} error={errors.sets}>
          <Input id={`${idPrefix}-sets`} type="number" inputMode="numeric" min="1" max="20" value={f.sets} onChange={(e) => set({ sets: e.target.value })} />
        </Field>
        {f.mode === "reps" ? (
          <Field label="Reps" error={errors.reps}>
            <Input id={`${idPrefix}-reps`} value={f.reps} maxLength={20} placeholder="8-12" onChange={(e) => set({ reps: e.target.value })} />
          </Field>
        ) : (
          <Field label="Time" error={errors.durationSec}>
            <div className="grid grid-cols-2 gap-1.5">
              <Input
                id={`${idPrefix}-min`}
                type="number"
                inputMode="numeric"
                min="0"
                max="120"
                suffix="min"
                aria-label="Minutes"
                value={f.min}
                onChange={(e) => set({ min: e.target.value })}
              />
              <Input
                type="number"
                inputMode="numeric"
                min="0"
                max="59"
                suffix="sec"
                aria-label="Seconds"
                value={f.sec}
                onChange={(e) => set({ sec: e.target.value })}
              />
            </div>
          </Field>
        )}
        <Field label="Rest" error={errors.restSec}>
          <Select id={`${idPrefix}-rest`} value={f.restSec} onChange={(e) => set({ restSec: e.target.value })}>
            {REST_OPTIONS.map((s) => (
              <option key={s} value={String(s)}>
                {formatRest(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Weight" optional error={errors.weightKg}>
          <Input
            id={`${idPrefix}-weight`}
            type="number"
            inputMode="decimal"
            min="0"
            step="0.5"
            suffix="kg"
            value={f.weightKg}
            onChange={(e) => set({ weightKg: e.target.value })}
          />
        </Field>
      </div>
      <Field label="Note for the member" optional error={errors.notes}>
        <Input
          id={`${idPrefix}-notes`}
          value={f.notes}
          maxLength={500}
          placeholder="e.g. Pause at the bottom"
          onChange={(e) => set({ notes: e.target.value })}
        />
      </Field>
    </div>
  );
}
