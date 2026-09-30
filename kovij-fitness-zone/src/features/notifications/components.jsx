import { Eye, EyeOff } from "lucide-react";
import { Badge } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { CHANNEL_STATUS, channelReason, kindMeta } from "./labels";

/** "Payment due" with its icon. */
export function KindBadge({ kind, size = "sm" }) {
  const meta = kindMeta(kind);
  return (
    <Badge size={size} icon={meta.icon}>
      {meta.label}
    </Badge>
  );
}

const TONES = {
  neutral: "bg-surface-2 text-ink-2",
  good: "bg-good-soft text-good",
  info: "bg-info-soft text-info",
  warn: "bg-warn-soft text-warn",
  bad: "bg-bad-soft text-bad",
};

/** Like Badge, but long reasons wrap instead of overflowing a phone screen. */
function Pill({ tone = "neutral", icon: Icon, children }) {
  return (
    <span className={cn("inline-flex max-w-full items-start gap-1 rounded-[10px] px-2 py-0.5 text-[11px] font-semibold leading-4", TONES[tone])}>
      {Icon && <Icon className="mt-0.5 size-3 shrink-0" aria-hidden strokeWidth={2.4} />}
      <span className="min-w-0">{children}</span>
    </span>
  );
}

/** One channel's outcome, e.g. "Email: Failed (email isn’t set up on the server)". */
export function ChannelBadge({ name, channel }) {
  const status = channel?.status || "skipped";
  const meta = CHANNEL_STATUS[status] || CHANNEL_STATUS.skipped;
  const reason = status === "sent" || status === "queued" ? "" : channelReason(channel?.reason);
  return (
    <Pill tone={meta.tone} icon={meta.icon}>
      {name}: {meta.label}
      {reason && <span className="font-medium"> ({reason})</span>}
    </Pill>
  );
}

/**
 * How a notification reached the member: in the app (read or not), email, phone.
 * Channels that weren't asked for (e.g. no email on an announcement) are left out.
 */
export function DeliveryBadges({ notification, className }) {
  const { channels = {}, readAt } = notification;
  const show = (c) => c && !(c.status === "skipped" && c.reason === "not_requested");
  return (
    <div className={className ?? "flex flex-wrap gap-1.5"}>
      <Pill tone={readAt ? "good" : "neutral"} icon={readAt ? Eye : EyeOff}>
        In app: {readAt ? "Read" : "Not read yet"}
      </Pill>
      {show(channels.email) && <ChannelBadge name="Email" channel={channels.email} />}
      {show(channels.push) && <ChannelBadge name="Phone" channel={channels.push} />}
    </div>
  );
}
