import { useUnfreezeMembership } from "./api";
import { dayWord, firstName, plusDays } from "./planDates";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useConfirm, useToast } from "../../shared/ui";
import { daysUntil, formatDate } from "../../shared/lib/format";

/**
 * Unfreeze (or remove a booked freeze) after a confirmation that spells out the new end date.
 * @returns (member, membership) => Promise<void>
 */
export function useUnfreezeAction() {
  const unfreeze = useUnfreezeMembership();
  const confirm = useConfirm();
  const toast = useToast();
  const idempotency = useIdempotencyKey();

  const run = async (member, membership) => {
    const f = membership?.freeze;
    if (!f) return;
    const started = daysUntil(f.startDate) <= 0;
    const soFar = started ? Math.min(f.days, Math.max(0, -daysUntil(f.startDate))) : 0;
    const unused = f.days - soFar;
    const newEnd = plusDays(membership.endDate, -unused);
    const ok = await confirm({
      title: started ? `Unfreeze ${firstName(member)}'s plan now?` : "Remove the booked freeze?",
      body: started
        ? `Frozen for ${dayWord(soFar)} so far. The ${dayWord(unused)} not used come off the plan, so it ends on ${formatDate(newEnd)}. They can check in straight away.`
        : `The plan carries on as normal and ends on ${formatDate(newEnd)}.`,
      confirmLabel: started ? "Unfreeze plan" : "Remove freeze",
      cancelLabel: "Keep it frozen",
    });
    if (!ok) return;
    const payload = { membershipId: membership._id, freezeId: f._id };
    unfreeze.mutate(
      { membershipId: membership._id, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          toast.success(started ? "Plan unfrozen" : "Freeze removed", { description: `${membership.planName} ends on ${formatDate(data.membership.endDate)}.` });
        },
        onError: (e) => toast.error(started ? "Couldn't unfreeze the plan" : "Couldn't remove the freeze", { description: e.message }),
      }
    );
  };
  return { run, isPending: unfreeze.isPending };
}
