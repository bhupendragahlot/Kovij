import { CircleCheck, Clock, Inbox, Lock } from "lucide-react";

/** Support request status, from the desk's point of view (icon + label, never colour alone). */
export const SUPPORT_STATUS = {
  open: { tone: "warn", icon: Inbox, label: "Needs reply" },
  waiting_member: { tone: "info", icon: Clock, label: "Waiting on member" },
  resolved: { tone: "good", icon: CircleCheck, label: "Resolved" },
  closed: { tone: "neutral", icon: Lock, label: "Closed" },
};

/** The same statuses as a member sees them in the app. */
export const SUPPORT_STATUS_MEMBER = {
  open: { tone: "warn", icon: Inbox, label: "With the gym" },
  waiting_member: { tone: "info", icon: Clock, label: "Gym replied" },
  resolved: { tone: "good", icon: CircleCheck, label: "Resolved" },
  closed: { tone: "neutral", icon: Lock, label: "Closed" },
};

export const SUPPORT_CATEGORY = {
  membership: "Membership",
  payment: "Payment",
  attendance: "Check-in and attendance",
  training: "Trainer and workouts",
  facilities: "Gym and equipment",
  app: "The app",
  other: "Something else",
};

/** One-tap starting points for common replies; the desk edits before sending. */
export const QUICK_REPLIES = [
  { label: "Checking", text: "Thanks for letting us know. We’re checking and will get back to you today." },
  { label: "Ask for UTR", text: "Could you share the UPI reference number (UTR) from your payment app? We’ll match it with our records." },
  { label: "Visit the desk", text: "Please drop by the front desk on your next visit and we’ll sort it out with you in person." },
  { label: "Sorted", text: "This is sorted now. Thanks for your patience, and see you at the gym!" },
];
