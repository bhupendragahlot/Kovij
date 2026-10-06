import { useEffect, useState } from "react";
import { useUpdateExerciseAssignment } from "./api";
import { PrescriptionFields } from "./PrescriptionFields";
import { prescriptionForm, toPrescription } from "./prescription";
import { Button, Dialog, Field, FormError, Input, useToast } from "../../../shared/ui";
import { gymDayKey } from "../../../shared/lib/format";

/** Move a scheduled exercise to another day, or change what to do. */
export function EditExerciseAssignmentDialog({ assignment: a, open, onClose }) {
  const update = useUpdateExerciseAssignment();
  const toast = useToast();
  const [date, setDate] = useState("");
  const [form, setForm] = useState(() => prescriptionForm(null, a));

  useEffect(() => {
    if (!open || !a) return;
    setDate(a.dayKey);
    setForm(prescriptionForm(null, a));
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, a?._id]);

  if (!a) return null;
  const errors = update.error?.fields || {};
  const today = gymDayKey();

  const submit = (e) => {
    e.preventDefault();
    update.mutate(
      { id: a._id, payload: { ...(date !== a.dayKey && { date }), ...toPrescription(form) } },
      {
        onSuccess: () => {
          toast.success(`${a.exercise.name} updated`);
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${a.exercise.name}`}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="edit-exercise-assignment" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <FormError error={update.error} />
      <form id="edit-exercise-assignment" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Day" error={errors.date}>
          <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <PrescriptionFields value={form} onChange={setForm} errors={errors} idPrefix="edit-ex" />
      </form>
    </Dialog>
  );
}
