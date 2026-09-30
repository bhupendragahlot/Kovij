import { Badge } from "./Badge";
import { LEAD_STATUS, MEMBER_STATE, MEMBERSHIP_STATUS, PAYMENT_STATUS } from "../domain/status";

const MAPS = {
  member: MEMBER_STATE,
  membership: MEMBERSHIP_STATUS,
  payment: PAYMENT_STATUS,
  lead: LEAD_STATUS,
};

/** `<StatusBadge kind="payment" status="pending" />` → amber "Due" with a clock icon. */
export function StatusBadge({ kind, status, size, className }) {
  const meta = MAPS[kind]?.[status];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size} className={className}>
      {meta.label}
    </Badge>
  );
}
