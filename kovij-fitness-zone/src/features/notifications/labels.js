import {
  Bell,
  Cake,
  CalendarClock,
  CalendarX2,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  Clock,
  HeartHandshake,
  IndianRupee,
  Megaphone,
  MessageSquareText,
} from "lucide-react";

/** What each kind of member notification is called on staff screens. */
export const NOTIFICATION_KIND = {
  expiry_reminder: { label: "Plan ending soon", icon: CalendarClock },
  expiry_today: { label: "Plan ends today", icon: CalendarX2 },
  come_back: { label: "We miss you", icon: HeartHandshake },
  payment_due: { label: "Payment due", icon: IndianRupee },
  birthday: { label: "Birthday wish", icon: Cake },
  announcement: { label: "Announcement", icon: Megaphone },
  message: { label: "Message", icon: MessageSquareText },
};

export const REMINDER_KINDS = ["expiry_reminder", "expiry_today", "come_back", "payment_due", "birthday"];

export function kindMeta(kind) {
  if (NOTIFICATION_KIND[kind]) return NOTIFICATION_KIND[kind];
  const label = String(kind || "Notification").replace(/_/g, " ");
  return { label: label.charAt(0).toUpperCase() + label.slice(1), icon: Bell };
}

/** Delivery status of one channel (email, push). Always icon + word. */
export const CHANNEL_STATUS = {
  sent: { tone: "good", icon: CircleCheck, label: "Sent" },
  queued: { tone: "info", icon: Clock, label: "Sending" },
  skipped: { tone: "neutral", icon: CircleMinus, label: "Not sent" },
  failed: { tone: "bad", icon: CircleAlert, label: "Failed" },
};

const REASONS = {
  no_email: "no email on file",
  opted_out: "turned off by the member",
  not_requested: "not chosen",
  push_not_configured: "phone notifications not set up",
  no_subscription: "notifications not turned on in the app",
  push_keys_invalid: "phone notification keys are wrong",
  subscription_expired: "device no longer available",
};

/** Plain words for a skip/failure reason from the server. */
export function channelReason(reason) {
  if (!reason) return "";
  if (REASONS[reason]) return REASONS[reason];
  if (/not configured/i.test(reason)) return "email isn’t set up on the server";
  if (/^push_service_\d+$/.test(reason)) return "the phone’s notification service refused it";
  if (/of \d+ devices/.test(reason)) return reason.replace("devices", "phones");
  return reason.length > 80 ? `${reason.slice(0, 80)}…` : reason;
}

/** Why a reminder was not planned for someone (preview). */
export const SKIP_REASON = {
  renewed: "already renewed",
  newer_plan: "has a newer plan",
  inactive: "member deactivated",
  opted_out: "turned off by the member",
  never_joined: "never had a plan",
  max_reached: "reminded 6 times already",
  too_soon: "reminded recently",
  already_reminded: "reminded earlier today",
};

export const AUDIENCE_LABEL = {
  all: "All members",
  active: "Members with a current plan",
  lapsed: "Lapsed members",
};
