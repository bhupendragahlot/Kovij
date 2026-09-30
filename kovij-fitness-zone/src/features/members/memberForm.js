/** Member form state helpers: blank state, form → API payloads, API → form, server field errors → form keys. */
import { gymDayKey } from "../../shared/lib/format";

export const EMPTY_DETAILS = {
  name: "",
  phone: "",
  email: "",
  gender: "",
  dob: "",
  line1: "",
  city: "",
  state: "",
  emergencyName: "",
  emergencyPhone: "",
  notes: "",
  /** `YYYY-MM-DD` in gym time. */
  joinedAt: "",
  referralChannel: "",
  /** The referring member ({ _id, name, memberCode, phone }) picked from search. */
  referredBy: null,
  /** Free-text name when the person who referred them isn't a member. */
  referredByName: "",
};

/** A new registration starts with today's date as the joining date. */
export const newMemberDetails = () => ({ ...EMPTY_DETAILS, joinedAt: gymDayKey() });

export const EMPTY_HEALTH = {
  heightCm: "",
  weightKg: "",
  bloodGroup: "",
  medicalHas: false,
  medicalDetails: "",
  injuries: "",
  allergies: "",
  goalKind: "",
  goalCustomText: "",
};

const blank = (v) => (v === "" || v == null ? undefined : v);

/** Referral part of the payload; `null` (when editing) clears a referral that was removed. */
function toReferralPayload(d, { clearable }) {
  const channel = blank(d.referralChannel);
  const referredByMemberId = d.referredBy?._id;
  const referredByName = referredByMemberId ? undefined : blank(d.referredByName?.trim());
  if (!channel && !referredByMemberId && !referredByName) return clearable ? null : undefined;
  return { channel, referredByMemberId, referredByName };
}

/** Form state → API `details` object. Pass `{ clearable: true }` when editing an existing member. */
export function toDetailsPayload(d, { clearable = false } = {}) {
  return {
    name: d.name.trim(),
    phone: d.phone.trim(),
    email: blank(d.email.trim()),
    gender: blank(d.gender),
    dob: blank(d.dob),
    address: { line1: blank(d.line1), city: blank(d.city), state: blank(d.state) },
    emergencyContact: { name: blank(d.emergencyName), phone: blank(d.emergencyPhone) },
    notes: blank(d.notes),
    joinedAt: blank(d.joinedAt),
    referral: toReferralPayload(d, { clearable }),
  };
}

/** Form state → API `health` object (only the fields that were filled in). */
export function toHealthPayload(h) {
  const out = {
    heightCm: h.heightCm ? Number(h.heightCm) : undefined,
    weightKg: h.weightKg ? Number(h.weightKg) : undefined,
    bloodGroup: blank(h.bloodGroup),
    injuries: blank(h.injuries),
    allergies: blank(h.allergies),
    goalKind: blank(h.goalKind),
    goalCustomText: blank(h.goalCustomText),
  };
  if (h.medicalHas || h.medicalDetails) {
    out.medicalHas = Boolean(h.medicalHas);
    out.medicalDetails = blank(h.medicalDetails);
  }
  return Object.values(out).some((v) => v !== undefined) ? out : undefined;
}

/** API member/profile → form state (for editing). */
export function fromMember(member = {}, profile = {}) {
  const ref = member.referral || {};
  const referrer = ref.referredByMemberId ? { _id: ref.referredByMemberId, name: ref.referredBy?.name || ref.referredByName || "Member", memberCode: ref.referredBy?.memberCode } : null;
  return {
    details: {
      ...EMPTY_DETAILS,
      name: member.name || "",
      phone: member.phone || "",
      email: member.email || "",
      gender: member.gender || "",
      dob: member.dob ? String(member.dob).slice(0, 10) : "",
      line1: member.address?.line1 || "",
      city: member.address?.city || "",
      state: member.address?.state || "",
      emergencyName: member.emergencyContact?.name || "",
      emergencyPhone: member.emergencyContact?.phone || "",
      notes: member.notes || "",
      joinedAt: gymDayKey(member.joinedAt || member.createdAt || new Date()),
      referralChannel: ref.channel || "",
      referredBy: referrer,
      referredByName: referrer ? "" : ref.referredByName || "",
    },
    health: {
      ...EMPTY_HEALTH,
      heightCm: profile?.heightCm ?? "",
      weightKg: profile?.weightKg ?? "",
      bloodGroup: profile?.bloodGroup || "",
      medicalHas: Boolean(profile?.medicalCondition?.has),
      medicalDetails: profile?.medicalCondition?.details || "",
      injuries: profile?.injuries || "",
      allergies: profile?.allergies || "",
      goalKind: profile?.fitnessGoal?.goalKind || "",
      goalCustomText: profile?.fitnessGoal?.customText || "",
    },
  };
}

const FIELD_KEYS = {
  "address.line1": "line1",
  "address.city": "city",
  "address.state": "state",
  "emergencyContact.name": "emergencyName",
  "emergencyContact.phone": "emergencyPhone",
  "referral.channel": "referralChannel",
  "referral.referredByMemberId": "referredBy",
  "referral.referredByName": "referredByName",
};

/** Map server field paths (details.phone) to form keys (phone). */
export function fieldErrorsFor(error, prefix) {
  const out = {};
  for (const [path, msg] of Object.entries(error?.fields || {})) {
    if (!path.startsWith(`${prefix}.`)) continue;
    const key = path.slice(prefix.length + 1);
    out[FIELD_KEYS[key] || key] = msg;
  }
  return out;
}
