import { useEffect, useState } from "react";
import { CalendarPlus, PauseCircle } from "lucide-react";
import { useExtendMembership, useFreezeMembership } from "./api";
import { addDaysToKey, dayStart, dayWord, firstName, plusDays } from "./planDates";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, Textarea, useToast } from "../../shared/ui";
import { formatDate, gymDayKey } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

/** Mirrors FREEZE_POLICY / EXTEND_POLICY on the server (services/membershipService.js). */
const MAX_FREEZE_DAYS = 90;
const MAX_FREEZE_AHEAD = 30;
const MAX_EXTEND_DAYS = 90;

function QuickDays({ values, value, onPick, label }) {
  return (
    <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label={label}>
      {values.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => onPick(String(d))}
          aria-pressed={String(value) === String(d)}
          className={cn(
            "h-9 rounded-full border px-3.5 text-sm font-semibold transition-colors",
            String(value) === String(d) ? "border-ink bg-ink text-canvas" : "border-line-strong text-ink-2 hover:border-ink-3 hover:text-ink"
          )}
        >
          {dayWord(d)}
        </button>
      ))}
    </div>
  );
}


/** Put the current plan on hold from a day, for a number of days. The end date moves out by the same days. */
export function FreezePlanDialog({ open, onClose, member, membership }) {
  const freeze = useFreezeMembership();
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const today = gymDayKey();
  const [form, setForm] = useState({ startDate: today, days: "", reason: "" });
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm({ startDate: gymDayKey(), days: "", reason: "" });
    setClientErrors({});
    freeze.reset();
    idempotency.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!membership) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const days = Number(form.days);
  const validDays = Number.isInteger(days) && days >= 1 && days <= MAX_FREEZE_DAYS;
  const planLastDay = gymDayKey(membership.endDate);
  const maxStart = [addDaysToKey(today, MAX_FREEZE_AHEAD), planLastDay].sort()[0];
  const startsToday = form.startDate === today;
  const errors = { ...freeze.error?.fields, ...clientErrors };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!form.startDate || form.startDate < today) next.startDate = "Choose today or a later date";
    else if (form.startDate > maxStart) next.startDate = `Choose a date up to ${formatDate(dayStart(maxStart))}`;
    if (!validDays) next.days = `Enter 1 to ${MAX_FREEZE_DAYS} days`;
    if (form.reason.trim().length < 3) next.reason = "Add a short reason, e.g. travelling or injury";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = { startDate: form.startDate, days, reason: form.reason.trim() };
    freeze.mutate(
      { membershipId: membership._id, payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const back = formatDate(dayStart(addDaysToKey(form.startDate, days)));
          toast.success(startsToday ? "Plan frozen" : "Freeze booked", { description: `Back on ${back}. The plan now ends on ${formatDate(data.membership.endDate)}.` });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Freeze ${firstName(member)}'s plan`}
      description={`${membership.planName}, ends ${formatDate(membership.endDate)}. They can't check in while it's frozen.`}
      placement="side"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="freeze-plan" variant="primary" icon={PauseCircle} loading={freeze.isPending} disabled={!online}>
            {startsToday ? "Freeze plan" : "Book freeze"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Freezing needs a connection. Reconnect to continue.
        </InlineAlert>
      )}
      <FormError error={freeze.error} />
      <form id="freeze-plan" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <Field label="First day on hold" error={errors.startDate} hint={startsToday ? "Starts now." : undefined}>
          <Input type="date" value={form.startDate} min={today} max={maxStart} onChange={(e) => set({ startDate: e.target.value })} />
        </Field>
        <Field label="Number of days" error={errors.days} hint={`Up to ${MAX_FREEZE_DAYS} days.`}>
          <Input type="number" inputMode="numeric" min="1" max={MAX_FREEZE_DAYS} value={form.days} onChange={(e) => set({ days: e.target.value })} suffix="days" />
        </Field>
        <QuickDays label="Common lengths" values={[7, 15, 30]} value={form.days} onPick={(d) => set({ days: d })} />
        <Field label="Reason" error={errors.reason} hint="For staff only. The member isn't shown this.">
          <Textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} maxLength={200} placeholder="e.g. Travelling home for Diwali" />
        </Field>
        {validDays && form.startDate >= today && (
          <dl className="rounded-tile bg-surface-2 p-4 text-sm">
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-ink-2">On hold</dt>
              <dd className="text-right font-semibold">
                {formatDate(dayStart(form.startDate))} to {formatDate(dayStart(addDaysToKey(form.startDate, days - 1)))}
              </dd>
            </div>
            <div className="flex justify-between gap-3 py-0.5">
              <dt className="text-ink-2">Back on</dt>
              <dd className="text-right font-semibold">{formatDate(dayStart(addDaysToKey(form.startDate, days)))}</dd>
            </div>
            <div className="mt-2 flex justify-between gap-3 border-t border-line pt-2">
              <dt className="font-semibold">Plan now ends</dt>
              <dd className="text-right font-bold">
                {formatDate(plusDays(membership.endDate, days))}
                <span className="block text-body-sm font-normal text-ink-3">was {formatDate(membership.endDate)}</span>
              </dd>
            </div>
          </dl>
        )}
      </form>
    </Dialog>
  );
}

const EXTEND_REASONS = ["Gym was closed", "Sorry for a problem", "Referral reward", "Festival offer"];

/** Complimentary days added to the end of the current plan. */
export function ExtendPlanDialog({ open, onClose, member, membership }) {
  const extend = useExtendMembership();
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [form, setForm] = useState({ days: "", reason: "" });
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setForm({ days: "", reason: "" });
    setClientErrors({});
    extend.reset();
    idempotency.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!membership) return null;
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const days = Number(form.days);
  const validDays = Number.isInteger(days) && days >= 1 && days <= MAX_EXTEND_DAYS;
  const errors = { ...extend.error?.fields, ...clientErrors };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!validDays) next.days = `Enter 1 to ${MAX_EXTEND_DAYS} days`;
    if (form.reason.trim().length < 3) next.reason = "Add a short reason";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = { days, reason: form.reason.trim() };
    extend.mutate(
      { membershipId: membership._id, payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          toast.success(`${dayWord(days)} added`, { description: `${membership.planName} now ends on ${formatDate(data.membership.endDate)}.` });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Add days for ${firstName(member)}`}
      description={`Free days at the end of ${membership.planName}. It ends on ${formatDate(membership.endDate)} now.`}
      placement="side"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="extend-plan" variant="primary" icon={CalendarPlus} loading={extend.isPending} disabled={!online}>
            {validDays ? `Add ${dayWord(days)}` : "Add days"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          Adding days needs a connection. Reconnect to continue.
        </InlineAlert>
      )}
      <FormError error={extend.error} />
      <form id="extend-plan" onSubmit={submit} noValidate className="flex flex-col gap-5">
        <div>
          <Field label="Days to add" error={errors.days} hint={`Up to ${MAX_EXTEND_DAYS} days.`}>
            <Input type="number" inputMode="numeric" min="1" max={MAX_EXTEND_DAYS} value={form.days} onChange={(e) => set({ days: e.target.value })} suffix="days" />
          </Field>
          <QuickDays label="Common amounts" values={[3, 7, 15]} value={form.days} onPick={(d) => set({ days: d })} />
        </div>
        <div>
          <Field label="Reason" error={errors.reason} hint="For staff only. The member only sees the new end date.">
            <Textarea rows={2} value={form.reason} onChange={(e) => set({ reason: e.target.value })} maxLength={200} />
          </Field>
          <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Common reasons">
            {EXTEND_REASONS.map((r) => (
              <button key={r} type="button" onClick={() => set({ reason: r })} className="h-9 rounded-full bg-surface-2 px-3 text-body-sm font-semibold text-ink-2 hover:bg-surface-3 hover:text-ink">
                {r}
              </button>
            ))}
          </div>
        </div>
        {validDays && (
          <p className="rounded-tile bg-surface-2 p-4 text-sm">
            Ends on <strong>{formatDate(plusDays(membership.endDate, days))}</strong> instead of {formatDate(membership.endDate)}.
          </p>
        )}
      </form>
    </Dialog>
  );
}
