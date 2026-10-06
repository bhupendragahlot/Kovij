import { useEffect, useState } from "react";
import { Dumbbell, Send } from "lucide-react";
import { useAssignPlan, useWorkoutPlans } from "./api";
import { MemberMultiPicker } from "./MemberMultiPicker";
import { LEVEL_LABEL, PLAN_GOAL_LABEL, perWeek } from "./labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { Button, Dialog, EmptyState, ErrorState, Field, FormError, InlineAlert, Input, SearchInput, SkeletonList, Switch, Textarea, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { gymDayKey } from "../../shared/lib/format";

/** Pick one plan (used when the member is fixed). */
function PlanChooser({ value, onChange, error }) {
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 200);
  const plans = useWorkoutPlans({ q: term || undefined, status: "active", limit: 50 });
  const items = plans.data?.items || [];
  return (
    <div className="flex flex-col gap-2">
      <SearchInput value={q} onChange={setQ} label="Search plans" placeholder="Search plans" />
      {error && <p className="text-body-sm font-medium text-bad">{error}</p>}
      {plans.isPending ? (
        <SkeletonList rows={3} />
      ) : plans.isError && !plans.data ? (
        <ErrorState compact error={plans.error} onRetry={() => plans.refetch()} />
      ) : items.length === 0 ? (
        <EmptyState compact icon={Dumbbell} title={term ? "No plans match" : "No workout plans yet"} body="Create a plan on the Workout plans page first." />
      ) : (
        <ul role="radiogroup" aria-label="Workout plan" className="flex max-h-80 flex-col gap-1 overflow-y-auto">
          {items.map((p) => {
            const on = value?._id === p._id;
            const empty = p.exerciseCount === 0;
            return (
              <li key={p._id}>
                <button
                  type="button"
                  role="radio"
                  aria-checked={on}
                  disabled={empty}
                  onClick={() => onChange(p)}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-tile border px-3 py-2.5 text-left transition-colors disabled:opacity-50",
                    on ? "border-brand bg-brand-soft" : "border-line hover:bg-surface-2"
                  )}
                >
                  <span className={cn("size-4 shrink-0 rounded-full border-2", on ? "border-brand bg-brand" : "border-line-strong")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.name}</span>
                    <span className="block truncate text-body-sm text-ink-3">
                      {empty ? "No exercises yet" : `${PLAN_GOAL_LABEL[p.goal]}, ${LEVEL_LABEL[p.level].toLowerCase()}, ${perWeek(p.daysPerWeek)}`}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * Give a workout plan to members. Either the plan is fixed (choose members) or one member is
 * fixed (choose a plan). The member's current plan, if any, ends and stays in their history.
 */
export function AssignPlanDialog({ open, onClose, plan: fixedPlan, member: fixedMember, currentPlanName, onDone }) {
  const assign = useAssignPlan();
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [plan, setPlan] = useState(fixedPlan || null);
  const [members, setMembers] = useState(fixedMember ? [fixedMember] : []);
  const [startDate, setStartDate] = useState(gymDayKey());
  const [notify, setNotify] = useState(true);
  const [notes, setNotes] = useState("");
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setPlan(fixedPlan || null);
    setMembers(fixedMember ? [fixedMember] : []);
    setStartDate(gymDayKey());
    setNotify(true);
    setNotes("");
    setClientErrors({});
    assign.reset();
    idempotency.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = { ...assign.error?.fields, ...clientErrors };
  const today = gymDayKey();

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!plan) next.plan = "Choose a plan";
    if (!members.length) next.memberIds = "Choose at least one member";
    if (!startDate) next.startDate = "Choose a start date";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = { memberIds: members.map((m) => m._id), startDate, notify, notes: notes.trim() || undefined };
    assign.mutate(
      { planId: plan._id, payload, idempotencyKey: idempotency.keyFor({ planId: plan._id, ...payload }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const n = data.assignments.length;
          toast.success(n === 1 ? `Plan given to ${data.assignments[0].memberName}` : `Plan given to ${n} members`, {
            description: notify ? "They'll get a message with the plan." : undefined,
          });
          onDone?.(data);
          onClose();
        },
      }
    );
  };

  const verb = members.length > 1 ? `Give plan to ${members.length} members` : "Give plan";

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fixedPlan ? `Give ${fixedPlan.name}` : fixedMember ? `Give ${fixedMember.name} a plan` : "Give a plan"}
      description="Members get their own copy, so later edits to the plan won't change it."
      placement="side"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-plan" variant="primary" icon={Send} loading={assign.isPending} disabled={!online}>
            {verb}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. Reconnect to give the plan.
        </InlineAlert>
      )}
      <FormError error={assign.error} />
      <form id="assign-plan" onSubmit={submit} noValidate className="flex flex-col gap-5">
        {!fixedPlan && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">Plan</legend>
            <PlanChooser value={plan} onChange={setPlan} error={errors.plan} />
          </fieldset>
        )}
        {!fixedMember && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">Members</legend>
            <MemberMultiPicker value={members} onChange={setMembers} error={errors.memberIds} max={50} />
          </fieldset>
        )}
        {fixedMember && currentPlanName && (
          <InlineAlert tone="info">
            This replaces {currentPlanName}. It stays in {fixedMember.name}'s history.
          </InlineAlert>
        )}
        <Field label="Starts on" error={errors.startDate} hint={startDate === today ? "Today" : undefined}>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
        <Field label="Note for the member" optional error={errors.notes} hint="Leave empty to use the plan's own notes.">
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} />
        </Field>
        <Switch
          label="Message the member"
          description="Sends the plan in the app, and by email if they have one and haven't turned workout updates off."
          checked={notify}
          onChange={setNotify}
        />
      </form>
    </Dialog>
  );
}
