import { Badge } from "../../shared/ui";
import { MEMBER_STATE_UI, MEMBERSHIP_STATUS_UI } from "./memberStatus";

/** A member's standing (Active, Ends soon, Frozen, …): icon + word, never colour alone. */
export function MemberStateBadge({ status, size, className }) {
  const meta = MEMBER_STATE_UI[status];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
      {meta.label}
    </Badge>
  );
}

/** One plan's status (Active, Starts later, Frozen, Ended, …). */
export function PlanStatusBadge({ status, size, className }) {
  const meta = MEMBERSHIP_STATUS_UI[status];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
      {meta.label}
    </Badge>
  );
}
