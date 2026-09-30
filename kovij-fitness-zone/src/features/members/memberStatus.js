import { PauseCircle } from "lucide-react";
import { MEMBER_STATE, MEMBERSHIP_STATUS } from "../../shared/domain/status";

/**
 * Status vocabulary for members and plans, including "frozen" (a plan on hold). Extends the shared
 * maps in shared/domain/status.js until they carry the paused member state themselves.
 */
export const MEMBER_STATE_UI = {
  ...MEMBER_STATE,
  paused: MEMBER_STATE.paused || { tone: "info", icon: PauseCircle, label: "Frozen" },
};

export const MEMBERSHIP_STATUS_UI = {
  ...MEMBERSHIP_STATUS,
  paused: { ...(MEMBERSHIP_STATUS.paused || { tone: "info", icon: PauseCircle }), label: "Frozen" },
};

/** How they heard about the gym (server enum: Member.referral.channel). */
export const REFERRAL_CHANNEL_LABEL = {
  friend: "Friend or member",
  instagram: "Instagram",
  google: "Google",
  walk_in: "Walked past",
  website: "Website",
  other: "Other",
};
