import { useEffect, useState } from "react";
import { useSaveEntry } from "./api";
import { TAPE_FIELDS } from "./labels";
import { shiftDayKey } from "../diet/labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, Textarea, useToast } from "../../shared/ui";
import { formatNumber, gymDayKey } from "../../shared/lib/format";

const NUMERIC = ["weightKg", "heightCm", "bodyFatPct", ...TAPE_FIELDS.map((f) => f.key)];
const str = (v) => (v == null ? "" : String(v));
const num = (v) => (v === "" || v == null ? null : Number(v));

function toForm(entry) {
  const form = { day: entry?.day || gymDayKey(), notes: entry?.notes || "" };
  for (const k of NUMERIC) form[k] = str(entry?.[k]);
  return form;
}

/**
 * Record or edit one day's measurements. One entry per day: if the day already has one, the
 * dialog offers to edit it instead. BMI is worked out by the server from weight and height.
 */
export function EntryDialog({ open, onClose, memberId, entry, entries = [], defaultHeightCm, onEditExisting }) {
  const save = useSaveEntry(memberId);
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [form, setForm] = useState(() => toForm(entry));
  const editing = Boolean(entry?._id);
  const today = gymDayKey();

  useEffect(() => {
    if (!open) return;
    save.reset();
    setForm(toForm(entry));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?._id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = save.error?.fields || {};
  const existing = save.error?.code === "ENTRY_EXISTS" ? entries.find((e) => e._id === save.error.details?.entryId) : null;

  const submit = (e) => {
    e.preventDefault();
    const payload = { day: form.day, notes: form.notes.trim() };
    for (const k of NUMERIC) payload[k] = num(form[k]);
    if (!editing) {
      for (const k of NUMERIC) if (payload[k] == null) delete payload[k];
    }
    save.mutate(
      { id: entry?._id, payload, idempotencyKey: editing ? undefined : idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const bmi = data.entry.bmi ? `BMI ${formatNumber(data.entry.bmi)}` : null;
          toast.success(editing ? "Entry saved" : "Entry added", { description: [data.entry.weightKg && `${formatNumber(data.entry.weightKg)} kg`, bmi].filter(Boolean).join(", ") || undefined });
          onClose();
        },
      }
    );
  };

  const numberInput = (key, suffix, { min, max, step = "0.1" } = {}) => (
    <Input type="number" inputMode="decimal" min={min} max={max} step={step} value={form[key]} onChange={(e) => set({ [key]: e.target.value })} suffix={suffix} />
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Edit measurements" : "Add measurements"}
      description="Fill in what you measured today. Everything is optional except one measurement."
      placement="side"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="progress-entry" variant="primary" loading={save.isPending} disabled={!online}>
            {editing ? "Save entry" : "Add entry"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You&apos;re offline. Reconnect to save measurements.
        </InlineAlert>
      )}
      {existing ? (
        <InlineAlert
          tone="warning"
          className="mb-4"
          action={
            onEditExisting && (
              <Button size="sm" variant="secondary" onClick={() => onEditExisting(existing)}>
                Edit that entry
              </Button>
            )
          }
        >
          {save.error.message}
        </InlineAlert>
      ) : (
        <FormError error={save.error} />
      )}
      <form id="progress-entry" onSubmit={submit} className="grid grid-cols-2 gap-3" noValidate>
        <Field label="Date" error={errors.day} className="col-span-2">
          <Input type="date" value={form.day} max={today} min={shiftDayKey(today, -365)} onChange={(e) => set({ day: e.target.value || today })} />
        </Field>
        <Field label="Weight" error={errors.weightKg}>
          {numberInput("weightKg", "kg", { min: 20, max: 300 })}
        </Field>
        <Field label="Height" error={errors.heightCm} hint={!form.heightCm && defaultHeightCm ? `Uses ${formatNumber(defaultHeightCm)} cm if empty` : undefined}>
          {numberInput("heightCm", "cm", { min: 90, max: 250 })}
        </Field>
        <Field label="Body fat" optional error={errors.bodyFatPct} className="col-span-2 sm:col-span-1">
          {numberInput("bodyFatPct", "%", { min: 2, max: 75 })}
        </Field>
        <fieldset className="col-span-2 mt-2">
          <legend className="text-sm font-semibold text-ink">Tape measurements</legend>
          <p className="mt-0.5 text-[13px] text-ink-3">In centimetres. Measure the same spot each time.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {TAPE_FIELDS.map((f) => (
              <Field key={f.key} label={f.label} error={errors[f.key]}>
                {numberInput(f.key, "cm", { min: f.min, max: f.max })}
              </Field>
            ))}
          </div>
        </fieldset>
        <Field label="Notes" optional error={errors.notes} className="col-span-2">
          <Textarea value={form.notes} onChange={(e) => set({ notes: e.target.value })} rows={2} maxLength={500} placeholder="e.g. Measured before workout, after breakfast" />
        </Field>
      </form>
    </Dialog>
  );
}
