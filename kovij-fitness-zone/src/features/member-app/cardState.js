import { CalendarClock, CircleAlert, CircleCheck, CircleDashed, Hourglass, PauseCircle, Wallet } from "lucide-react";

/** What the card says for each standing (GET /member/membership). */
export function cardState(s) {
  const m = s.membership;
  if (s.state === "active" && s.endingSoon) return { key: "ending", icon: Hourglass, badge: "Ends soon", tone: "warn" };
  if (s.state === "active") return { key: "active", icon: CircleCheck, badge: "Active", tone: "good" };
  if (s.state === "paused") return { key: "paused", icon: PauseCircle, badge: "Frozen", tone: "info" };
  if (s.state === "pending") return { key: "pending", icon: Wallet, badge: "Awaiting payment", tone: "warn" };
  if (s.state === "upcoming") return { key: "upcoming", icon: CalendarClock, badge: "Starts soon", tone: "info" };
  if (s.state === "expired" && m) return { key: "expired", icon: CircleAlert, badge: "Ended", tone: "bad" };
  return { key: "none", icon: CircleDashed, badge: "No plan yet", tone: "neutral" };
}
