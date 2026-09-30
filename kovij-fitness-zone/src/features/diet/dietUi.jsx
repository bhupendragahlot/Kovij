import { useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { useAssignDiet, useDietPlans, useMemberDiet } from "./api";
import { DIET_TYPE, formatKcal, shiftDayKey } from "./labels";
import { MemberPicker } from "../members/MemberPicker";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Badge, Button, Dialog, Field, FormError, InlineAlert, Input, Select, Textarea, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatDate, formatNumber, gymDayKey } from "../../shared/lib/format";

export function DietTypeBadge({ type, size = "sm" }) {
  const meta = DIET_TYPE[type];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size}>
      {meta.label}
    </Badge>
  );
}

/** "373 kcal, 11.4 g protein, 54.6 g carbs, 12.6 g fat" */
export function MacroLine({ totals, className }) {
  if (!totals) return null;
  return (
    <p className={cn("tabular text-[13px] text-ink-3", className)}>
      <span className="font-semibold text-ink-2">{formatKcal(totals.calories)}</span>, {formatNumber(totals.proteinG)} g protein, {formatNumber(totals.carbsG)} g carbs,{" "}
      {formatNumber(totals.fatG)} g fat
    </p>
  );
}

/**
 * Amount against a daily target. Going over is flagged in words (and a warning colour), because
 * for a gym diet "over" matters more than "nearly there".
 */
export function TargetBar({ label, value, target, unit = "kcal", className }) {
  const fmt = (n) => `${formatNumber(Math.round(Number(n) * 10) / 10)} ${unit}`;
  const hasTarget = Number(target) > 0;
  const pct = hasTarget ? Math.min(100, (value / target) * 100) : 0;
  const over = hasTarget && value > target;
  return (
    <div className={className}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular text-ink-3">
          <strong className="font-bold text-ink">{fmt(value)}</strong>
          {hasTarget && ` of ${fmt(target)}`}
        </span>
      </div>
      {hasTarget && (
        <div
          role="meter"
          aria-label={`${label}: ${fmt(value)} of ${fmt(target)}`}
          aria-valuemin={0}
          aria-valuemax={Number(target)}
          aria-valuenow={Number(value)}
          className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-surface-3"
        >
          <div className={cn("h-full rounded-full transition-[width] duration-300", over ? "bg-warn" : "bg-brand")} style={{ width: `${pct}%` }} />
        </div>
      )}
      {over && (
        <p className="mt-1 flex items-center gap-1 text-[13px] font-semibold text-warn">
          <TriangleAlert className="size-3.5" aria-hidden />
          Over by {fmt(value - target)}
        </p>
      )}
    </div>
  );
}

/** Server limits for a plan's start date. */
const START_DAYS_BACK = 7;
const START_DAYS_AHEAD = 30;

/**
 * Give a diet plan to a member. Opened from a member's profile (member fixed, pick the plan) or
 * from a plan's page (plan fixed, pick the member). Idempotent: a double tap assigns once.
 */
export function AssignDietDialog({ open, onClose, member: fixedMember, plan: fixedPlan, currentPlanName }) {
  const today = gymDayKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const idempotency = useIdempotencyKey();
  const [member, setMember] = useState(null);
  const [planId, setPlanId] = useState("");
  const [startDay, setStartDay] = useState(today);
  const [note, setNote] = useState("");
  const target = fixedMember || member;
  const assign = useAssignDiet(target?._id);
  const plans = useDietPlans({ archived: "false", limit: 100 }, { enabled: open && !fixedPlan });
  const targetDiet = useMemberDiet(open && !fixedMember ? member?._id : null);
  const replacing = currentPlanName || targetDiet.data?.current?.name;

  useEffect(() => {
    if (!open) return;
    assign.reset();
    setMember(null);
    setPlanId(fixedPlan?._id || "");
    setStartDay(gymDayKey());
    setNote("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const errors = assign.error?.fields || {};
  const choosable = (plans.data?.plans || []).filter((p) => p.mealCount > 0);
  const chosenPlan = fixedPlan || choosable.find((p) => p._id === planId);

  const submit = (e) => {
    e.preventDefault();
    if (!target || !chosenPlan) return;
    const payload = { planId: chosenPlan._id, startDay, note: note.trim() || undefined };
    assign.mutate(
      { memberId: target._id, payload, idempotencyKey: idempotency.keyFor({ memberId: target._id, ...payload }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const first = String(target.name || "").split(" ")[0];
          toast.success(`Plan assigned to ${first}`, {
            description: data.assignment.state === "upcoming" ? `${data.assignment.name} starts ${formatDate(data.assignment.startDate)}.` : `${data.assignment.name}. They'll see it in the member app.`,
          });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fixedMember ? `Assign a diet plan to ${fixedMember.name.split(" ")[0]}` : `Assign ${fixedPlan?.name || "plan"}`}
      description="The member gets a copy of the plan. Later edits to the plan don't change their copy."
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-diet" variant="primary" loading={assign.isPending} disabled={!online || !target || !chosenPlan}>
            Assign plan
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You&apos;re offline. Reconnect to assign a plan.
        </InlineAlert>
      )}
      <FormError error={assign.error} />
      <form id="assign-diet" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        {!fixedMember && (
          <Field label="Member" required>
            <MemberPicker value={member} onChange={setMember} />
          </Field>
        )}
        {!fixedPlan && (
          <Field
            label="Diet plan"
            required
            error={errors.planId}
            hint={plans.data && !choosable.length ? "No plans with meals yet. Create one under Diet plans first." : undefined}
          >
            <Select value={planId} onChange={(e) => setPlanId(e.target.value)} placeholder={plans.isPending ? "Loading plans…" : "Choose a plan"} disabled={plans.isPending}>
              {choosable.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({DIET_TYPE[p.dietType]?.label}, {formatKcal(p.totals.calories)})
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Starts on" error={errors.startDay} hint="Today unless the member starts later.">
          <Input type="date" value={startDay} min={shiftDayKey(today, -START_DAYS_BACK)} max={shiftDayKey(today, START_DAYS_AHEAD)} onChange={(e) => setStartDay(e.target.value || today)} />
        </Field>
        <Field label="Note for the member" optional error={errors.note}>
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500} placeholder="e.g. Drink 3 litres of water. Skip sugar in tea." />
        </Field>
        {replacing && (
          <InlineAlert tone="info">
            This replaces <strong>{replacing}</strong> from the start date. Their past days stay as they were.
          </InlineAlert>
        )}
      </form>
    </Dialog>
  );
}
