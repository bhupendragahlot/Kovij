import { CircleCheck, Clock, Hourglass, Undo2, XCircle } from "lucide-react";

/**
 * Payment vocabulary for the payments module. Extends shared/domain/status.js with the states
 * this module adds (refunded, UPI reference waiting to be checked) and the online mode.
 * Tone, icon and label travel together so status never depends on colour alone.
 */
export const PAYMENT_STATE = {
  paid: { tone: "good", icon: CircleCheck, label: "Paid" },
  pending: { tone: "warn", icon: Clock, label: "Due" },
  awaiting: { tone: "info", icon: Hourglass, label: "Check UPI" },
  refunded: { tone: "neutral", icon: Undo2, label: "Refunded" },
  failed: { tone: "neutral", icon: XCircle, label: "Cancelled" },
};

/** The state to show for a payment row. */
export const paymentState = (p) => (p?.status === "pending" && p?.verification?.state === "submitted" ? "awaiting" : p?.status);

export const MODE_LABEL = { cash: "Cash", upi: "UPI", card: "Card", online: "Online" };

export const TYPE_LABEL = {
  registration: "Registration fee",
  membership: "Membership",
  renewal: "Renewal",
  personal_training: "Personal training",
  other: "Other",
};

export const TYPE_OPTIONS = ["membership", "renewal", "registration", "personal_training", "other"];
