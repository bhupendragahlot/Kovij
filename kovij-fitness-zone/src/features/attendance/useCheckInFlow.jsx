import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, RefreshCw, Wallet } from "lucide-react";
import { useCheckIn, useUndoCheckIn } from "./api";
import { BlockedBadge } from "./components";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import { Avatar, Button, Dialog, Field, Input, useToast } from "../../shared/ui";
import { formatDate, formatTime } from "../../shared/lib/format";

export function membershipLine(membership) {
  if (!membership?.planName) return "No plan on file";
  if (membership.state === "paused") return `${membership.planName}, on hold`;
  if (membership.state !== "active") return membership.planName;
  if (membership.daysLeft <= 0) return `${membership.planName}, ends today`;
  return `${membership.planName}, ${membership.daysLeft} ${membership.daysLeft === 1 ? "day" : "days"} left`;
}

/** What to do next, after the server's reason ("Priya's plan ended on 3 Sep 2026"). */
function nextStep(state) {
  if (state === "pending") return "Collect the payment to start the plan.";
  if (state === "paused") return "Resume the plan from the member's profile if they are back early.";
  if (state === "upcoming") return "Their new plan starts later. Let them in once, or change the start date.";
  if (state === "none") return "Sell a plan, or let them in once for a trial.";
  return "Renew the plan, or let them in once.";
}

/**
 * Check a member in from anywhere (Check-in page, member list, profile, desk scanner).
 * Handles the outcomes: checked in (with Undo), back again after checking out, already here
 * today, or refused because the plan isn't active, which offers "Renew" or "Let in once" with a
 * reason. `checkIn(member, { method: "qr" })` records that the member was found by their QR code.
 */
export function useCheckInFlow({ onCheckedIn } = {}) {
  const navigate = useNavigate();
  const toast = useToast();
  const checkInMutation = useCheckIn();
  const undo = useUndoCheckIn();
  const [blocked, setBlocked] = useState(null);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);

  const run = async (member, extra = {}) => {
    try {
      const res = await checkInMutation.mutateAsync({ memberId: member._id || member.id, ...extra, idempotencyKey: newIdempotencyKey() });
      if (res.alreadyCheckedIn) {
        toast.info(`${res.member.name} is already checked in`, { description: `Arrived at ${formatTime(res.attendance.checkedInAt)}` });
      } else {
        const endingSoon = res.membership?.state === "active" && res.membership.daysLeft <= 3;
        const title = res.returned ? `${res.member.name} checked in again` : `${res.member.name} checked in`;
        toast[endingSoon ? "warning" : "success"](title, {
          description: endingSoon ? `${membershipLine(res.membership)}. Offer a renewal.` : membershipLine(res.membership),
          action: res.returned
            ? undefined
            : {
                label: "Undo",
                onClick: () => undo.mutate(res.attendance._id, { onSuccess: () => toast.info(`Check-in for ${res.member.name} undone`) }),
              },
        });
      }
      onCheckedIn?.(res);
      return res;
    } catch (err) {
      if (err.code === "MEMBERSHIP_INACTIVE") {
        setBlocked({ ...err.details, message: err.message, extra });
        setReason("");
        setReasonError(null);
        return null;
      }
      if (err.fields?.overrideReason) {
        setReasonError(err.fields.overrideReason);
        return null;
      }
      toast.error("Couldn't check in", { description: err.message });
      return null;
    }
  };

  const letInOnce = async () => {
    if (!reason.trim()) {
      setReasonError("Add a reason, for example “paying tomorrow”");
      return;
    }
    const res = await run(blocked.member, { ...blocked.extra, override: true, overrideReason: reason.trim() });
    if (res) setBlocked(null);
  };

  const state = blocked?.membership?.state;
  const pending = state === "pending";
  const dialog = (
    <Dialog
      open={Boolean(blocked)}
      onClose={() => setBlocked(null)}
      title="Plan not active"
      size="sm"
      footer={
        <>
          <Button variant="secondary" icon={DoorOpen} onClick={letInOnce} loading={checkInMutation.isPending}>
            Let in once
          </Button>
          <Button
            variant="primary"
            icon={pending ? Wallet : RefreshCw}
            onClick={() => {
              const id = blocked.member._id;
              setBlocked(null);
              navigate(`/admin/members/${id}?action=${pending ? "pay" : "renew"}`);
            }}
          >
            {pending ? "Collect payment" : "Renew plan"}
          </Button>
        </>
      }
    >
      {blocked && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 rounded-tile bg-surface-2 p-3">
            <Avatar name={blocked.member.name} src={blocked.member.profilePhoto} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{blocked.member.name}</p>
              <p className="text-[13px] text-ink-3">{blocked.member.memberCode}</p>
            </div>
            <BlockedBadge state={state} />
          </div>
          <p className="text-[15px] text-ink-2">
            {blocked.message || `${blocked.member.name}'s plan ended on ${formatDate(blocked.membership?.endDate)}`}. {nextStep(state)}
          </p>
          <Field label="Reason for letting in once" hint="Saved with the visit so the owner can review it." error={reasonError}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Paying tomorrow" maxLength={200} />
          </Field>
        </div>
      )}
    </Dialog>
  );

  return { checkIn: run, isPending: checkInMutation.isPending, dialog };
}
