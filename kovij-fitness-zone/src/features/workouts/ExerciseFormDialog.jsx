import { useEffect, useState } from "react";
import { useSaveExercise } from "./api";
import { CATEGORY_LABEL, EQUIPMENT_LABEL, MUSCLE_LABEL } from "./labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, Select, Textarea, chipClasses, useToast } from "../../shared/ui";

const EMPTY = { name: "", primaryMuscle: "", secondaryMuscles: [], equipment: "", category: "strength", instructions: "", videoUrl: "" };

/** Add or edit one library exercise. `onSaved(exercise)` lets a picker select what was just added. */
export function ExerciseFormDialog({ open, exercise, initialName = "", onClose, onSaved }) {
  const save = useSaveExercise();
  const toast = useToast();
  const online = useOnlineStatus();
  const idempotency = useIdempotencyKey();
  const [form, setForm] = useState(EMPTY);
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    save.reset();
    idempotency.reset();
    setClientErrors({});
    setForm(exercise ? { ...EMPTY, ...exercise, instructions: exercise.instructions || "", videoUrl: exercise.videoUrl || "" } : { ...EMPTY, name: initialName });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = { ...save.error?.fields, ...clientErrors };

  const toggleSecondary = (m) =>
    set({ secondaryMuscles: form.secondaryMuscles.includes(m) ? form.secondaryMuscles.filter((x) => x !== m) : [...form.secondaryMuscles, m] });

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.name.trim()) next.name = "Name the exercise";
    if (!form.primaryMuscle) next.primaryMuscle = "Choose the main muscle";
    if (!form.equipment) next.equipment = "Choose the equipment";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = {
      name: form.name.trim(),
      primaryMuscle: form.primaryMuscle,
      secondaryMuscles: form.secondaryMuscles.filter((m) => m !== form.primaryMuscle),
      equipment: form.equipment,
      category: form.category,
      instructions: form.instructions,
      videoUrl: form.videoUrl.trim(),
    };
    save.mutate(
      { id: exercise?._id, payload, idempotencyKey: exercise ? undefined : idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          toast.success(exercise ? "Exercise saved" : `${data.exercise.name} added`);
          onSaved?.(data.exercise);
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={exercise ? `Edit ${exercise.name}` : "Add an exercise"}
      description={exercise?.builtIn ? "Changes apply everywhere this exercise is used in new plans." : undefined}
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="exercise-form" variant="primary" loading={save.isPending} disabled={!online}>
            {exercise ? "Save exercise" : "Add exercise"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. Reconnect to save.
        </InlineAlert>
      )}
      <FormError error={save.error} />
      <form id="exercise-form" onSubmit={submit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name" error={errors.name} required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} placeholder="e.g. Incline cable fly" />
        </Field>
        <Field label="Main muscle" error={errors.primaryMuscle} required>
          <Select value={form.primaryMuscle} onChange={(e) => set({ primaryMuscle: e.target.value })} placeholder="Choose">
            {Object.entries(MUSCLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Equipment" error={errors.equipment} required>
          <Select value={form.equipment} onChange={(e) => set({ equipment: e.target.value })} placeholder="Choose">
            {Object.entries(EQUIPMENT_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Type" error={errors.category}>
          <Select value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {Object.entries(CATEGORY_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <fieldset className="sm:col-span-2">
          <legend className="mb-1.5 text-sm font-semibold text-ink">
            Also works <span className="font-normal text-ink-3">(optional)</span>
          </legend>
          <div className="flex flex-wrap gap-2">
            {Object.entries(MUSCLE_LABEL)
              .filter(([v]) => v !== form.primaryMuscle)
              .map(([v, l]) => {
                const on = form.secondaryMuscles.includes(v);
                return (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleSecondary(v)}
                    className={chipClasses(on)}
                  >
                    {l}
                  </button>
                );
              })}
          </div>
        </fieldset>
        <Field label="How to do it" optional error={errors.instructions} className="sm:col-span-2" hint="Two or three short cues members can follow on the floor.">
          <Textarea value={form.instructions} onChange={(e) => set({ instructions: e.target.value })} rows={4} maxLength={2000} />
        </Field>
        <Field label="Video link" optional error={errors.videoUrl} className="sm:col-span-2" hint="A YouTube or Instagram link showing the movement.">
          <Input type="url" inputMode="url" value={form.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder="https://" />
        </Field>
      </form>
    </Dialog>
  );
}
