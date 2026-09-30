/** Member form state helpers: blank state, form → API payloads, API → form, server field errors → form keys. */

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
};

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

/** Form state → API `details` object. */
export function toDetailsPayload(d) {
  return {
    name: d.name.trim(),
    phone: d.phone.trim(),
    email: blank(d.email.trim()),
    gender: blank(d.gender),
    dob: blank(d.dob),
    address: { line1: blank(d.line1), city: blank(d.city), state: blank(d.state) },
    emergencyContact: { name: blank(d.emergencyName), phone: blank(d.emergencyPhone) },
    notes: blank(d.notes),
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

/** Map server field paths (details.phone) to form keys (phone). */
export function fieldErrorsFor(error, prefix) {
  const out = {};
  for (const [path, msg] of Object.entries(error?.fields || {})) {
    if (!path.startsWith(`${prefix}.`)) continue;
    const key = path.slice(prefix.length + 1);
    const map = { "address.line1": "line1", "address.city": "city", "address.state": "state", "emergencyContact.name": "emergencyName", "emergencyContact.phone": "emergencyPhone" };
    out[map[key] || key] = msg;
  }
  return out;
}
