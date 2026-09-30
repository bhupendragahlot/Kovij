import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DoorOpen, RefreshCw, Wallet } from "lucide-react";
import { useCheckIn, useUndoCheckIn } from "./api";
import { Avatar, Button, Dialog, Field, Input, StatusBadge, useToast } from "../../shared/ui";
import { formatDate, formatTime } from "../../shared/lib/format";

export function membershipLine(membership) {
  if (!membership?.planName) return "No plan on file";
  if (membership.state !== "active") return membership.planName;
  if (membership.daysLeft <= 0) return `${membership.planName}, ends today`;
  return `${membership.planName}, ${membership.daysLeft} ${membership.daysLeft === 1 ? "day" : "days"} left`;
}

function blockedCopy({ member, membership }) {
  if (membership?.state === "pending") return `${member.name}'s registration is waiting for payment. Collect it to start the plan.`;
  if (membership?.state === "none") return `${member.name} doesn't have a plan yet.`;
  if (membership?.state === "upcoming") return `${member.name}'s next plan hasn't started yet.`;
  return `${member.name}'s ${membership?.planName || "plan"} ended on ${formatDate(membership?.endDate)}.`;
}

/**
 * Check a member in from anywhere (Check-in page, member list, profile).
 * Handles the three outcomes: checked in (with Undo), already here today, or blocked
 * because the plan isn't active, which offers "Renew" or "Let in once" with a reason.
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
      const res = await checkInMutation.mutateAsync({ memberId: member._id || member.id, ...extra });
      if (res.alreadyCheckedIn) {
        toast.info(`${res.member.name} is already checked in`, { description: `Arrived at ${formatTime(res.attendance.checkedInAt)}` });
      } else {
        const endingSoon = res.membership?.state === "active" && res.membership.daysLeft <= 3;
        toast[endingSoon ? "warning" : "success"](`${res.member.name} checked in`, {
          description: endingSoon ? `${membershipLine(res.membership)}. Offer a renewal.` : membershipLine(res.membership),
          action: {
            label: "Undo",
            onClick: () => undo.mutate(res.attendance._id, { onSuccess: () => toast.info(`Check-in for ${res.member.name} undone`) }),
          },
        });
      }
      onCheckedIn?.(res);
      return res;
    } catch (err) {
      if (err.code === "MEMBERSHIP_INACTIVE") {
        setBlocked(err.details);
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
    const res = await run(blocked.member, { override: true, overrideReason: reason.trim() });
    if (res) setBlocked(null);
  };

  const pending = blocked?.membership?.state === "pending";
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
            <StatusBadge kind="member" status={blocked.membership?.state === "pending" ? "pending" : blocked.membership?.state === "none" ? "none" : "expired"} size="sm" />
          </div>
          <p className="text-[15px] text-ink-2">{blockedCopy(blocked)}</p>
          <Field label="Reason for letting in once" hint="Saved with the visit so the owner can review it." error={reasonError}>
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Paying tomorrow" maxLength={200} />
          </Field>
        </div>
      )}
    </Dialog>
  );

  return { checkIn: run, isPending: checkInMutation.isPending, dialog };
}
