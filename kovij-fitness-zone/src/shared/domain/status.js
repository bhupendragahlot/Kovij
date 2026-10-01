import {
  Ban,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  CircleDashed,
  Clock,
  Hourglass,
  Sparkles,
  Wallet,
  UserRound,
  PhoneCall,
  Flame,
  XCircle,
  PauseCircle,
  UserPlus,
  Dumbbell,
  Footprints,
  IndianRupee,
  Building2,
  BadgeCheck,
  Briefcase,
} from "lucide-react";

/**
 * One vocabulary for every status shown in the app: tone (colour), icon and label always
 * travel together so status never depends on colour alone.
 */
export const MEMBER_STATE = {
  active: { tone: "good", icon: CircleCheck, label: "Active" },
  expiring: { tone: "warn", icon: Hourglass, label: "Ends soon" },
  upcoming: { tone: "info", icon: CalendarClock, label: "Starts later" },
  pending: { tone: "warn", icon: Wallet, label: "Awaiting payment" },
  paused: { tone: "info", icon: PauseCircle, label: "Frozen" },
  expired: { tone: "bad", icon: CircleAlert, label: "Lapsed" },
  none: { tone: "neutral", icon: CircleDashed, label: "No plan" },
};

export const MEMBERSHIP_STATUS = {
  active: { tone: "good", icon: CircleCheck, label: "Active" },
  upcoming: { tone: "info", icon: CalendarClock, label: "Starts later" },
  pending: { tone: "warn", icon: Wallet, label: "Awaiting payment" },
  expired: { tone: "neutral", icon: Clock, label: "Ended" },
  cancelled: { tone: "neutral", icon: Ban, label: "Cancelled" },
  paused: { tone: "info", icon: PauseCircle, label: "Frozen" },
};

export const PAYMENT_STATUS = {
  paid: { tone: "good", icon: CircleCheck, label: "Paid" },
  pending: { tone: "warn", icon: Clock, label: "Due" },
  failed: { tone: "bad", icon: XCircle, label: "Failed" },
};

export const LEAD_STATUS = {
  new: { tone: "info", icon: Sparkles, label: "New" },
  contacted: { tone: "neutral", icon: PhoneCall, label: "Contacted" },
  trial: { tone: "brand", icon: Flame, label: "On trial" },
  won: { tone: "good", icon: UserRound, label: "Joined" },
  lost: { tone: "neutral", icon: Ban, label: "Lost" },
};

export const PAYMENT_TYPE_LABEL = {
  registration: "Registration fee",
  membership: "Membership",
  renewal: "Renewal",
  personal_training: "Personal training",
  other: "Other",
};

export const PAYMENT_MODE_LABEL = { cash: "Cash", upi: "UPI", card: "Card" };

/** What a website enquiry is about, as sorted automatically (server/services/leadTriage.js). */
export const ENQUIRY_TOPIC = {
  join: { icon: UserPlus, label: "Wants to join" },
  personal_training: { icon: Dumbbell, label: "Personal training" },
  trial_visit: { icon: Footprints, label: "Trial or visit" },
  fees: { icon: IndianRupee, label: "Asking fees" },
  timings: { icon: Clock, label: "Asking timings" },
  facilities: { icon: Building2, label: "Asking facilities" },
  existing_member: { icon: BadgeCheck, label: "Member issue" },
  business: { icon: Briefcase, label: "Job or business" },
};

export const LEAD_SOURCE_LABEL = {
  walk_in: "Walk-in",
  phone: "Phone call",
  website: "Website",
  instagram: "Instagram",
  referral: "Referral",
  other: "Other",
};

export const PLAN_DURATION_LABEL = {
  day: "1 day",
  week: "1 week",
  month: "1 month",
  quarter: "3 months",
  half_year: "6 months",
  year: "1 year",
};

export const GOAL_LABEL = {
  weight_loss: "Weight loss",
  weight_gain: "Weight gain",
  muscle_building: "Muscle building",
  general_fitness: "General fitness",
  other: "Other",
};

export const ROLE_LABEL = { admin: "Owner (admin)", manager: "Manager", staff: "Front desk", trainer: "Trainer" };
