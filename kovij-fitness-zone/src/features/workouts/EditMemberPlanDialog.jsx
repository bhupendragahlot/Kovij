import { useEffect, useState } from "react";
import { useUpdateAssignment } from "./api";
import { PlanDaysEditor } from "./PlanDaysEditor";
import { draftProblems, toDraftDays, toPayloadDays } from "./planDraft";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, Select, Switch, Textarea, useToast } from "../../shared/ui";

/** Change one member's copy of their plan (weights, sets, swaps). The template is not touched. */
export function EditMemberPlanDialog({ open, onClose, assignment, memberName }) {
  const update = useUpdateAssignment();
  const online = useOnlineStatus();
  const toast = useToast();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [daysPerWeek, setDaysPerWeek] = useState(3);
  const [days, setDays] = useState([]);
  const [notify, setNotify] = useState(true);
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open || !assignment) return;
    setName(assignment.name);
    setNotes(assignment.notes || "");
    setDaysPerWeek(assignment.daysPerWeek || 3);
    setDays(toDraftDays(assignment.days));
    setNotify(true);
    setClientErrors({});
    update.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = { ...update.error?.fields, ...clientErrors };

  const submit = (e) => {
    e.preventDefault();
    const problems = draftProblems(days);
    if (!name.trim()) problems.name = "Name the plan";
    setClientErrors(problems);
    if (Object.keys(problems).length) return;
    update.mutate(
      { id: assignment._id, payload: { name: name.trim(), notes: notes.trim(), daysPerWeek: Number(daysPerWeek), days: toPayloadDays(days), notify } },
      {
        onSuccess: () => {
          toast.success(`Plan saved for ${memberName}`, { description: notify ? "They'll see a message about the change." : undefined });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Edit ${memberName}'s plan`}
      description="Changes apply to this member only. The plan template stays as it is."
      placement="side"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-plan" variant="primary" loading={update.isPending} disabled={!online}>
            Save plan
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. Reconnect to save.
        </InlineAlert>
      )}
      <FormError error={update.error} />
      <form id="member-plan" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Plan name" error={errors.name} required className="sm:col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
          </Field>
          <Field label="Sessions a week" error={errors.daysPerWeek}>
            <Select value={daysPerWeek} onChange={(e) => setDaysPerWeek(Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes for the member" optional error={errors.notes} className="sm:col-span-3">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={2000} />
          </Field>
        </div>
        <PlanDaysEditor days={days} onChange={setDays} errors={errors} />
        <Switch label={`Tell ${memberName} about the change`} description="Shows in their app and on their phone if they allow workout updates." checked={notify} onChange={setNotify} />
      </form>
    </Dialog>
  );
}
