import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { memberApi } from "../../lib/memberApi";
import { BentoCard, BentoGrid, MemberPage, SoftButton } from "../../components/member/bento/BentoUI";

export default function MemberProfile() {
  const { member, logout } = useMemberAuth();
  const [data, setData] = useState(null);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({
    name: "",
    phone: "",
    gender: "prefer_not_say",
    dob: "",
    city: "",
    state: "",
    line1: "",
    heightCm: "",
    weightKg: "",
    bloodGroup: "",
    medicalHas: false,
    medicalDetails: "",
    injuries: "",
    allergies: "",
    goalKind: "general_fitness",
    goalCustomText: "",
  });

  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const { data } = await memberApi.get("/member/auth/profile");
        setData(data);
        const m = data.member || {};
        const p = data.profile || {};
        setForm((f) => ({
          ...f,
          name: m.name || "",
          phone: m.phone || "",
          gender: m.gender || "prefer_not_say",
          dob: m.dob ? String(m.dob).slice(0, 10) : "",
          city: m.address?.city || "",
          state: m.address?.state || "",
          line1: m.address?.line1 || "",
          heightCm: p.heightCm ?? "",
          weightKg: p.weightKg ?? "",
          bloodGroup: p.bloodGroup || "",
          medicalHas: Boolean(p.medicalCondition?.has),
          medicalDetails: p.medicalCondition?.details || "",
          injuries: p.injuries || "",
          allergies: p.allergies || "",
          goalKind: p.fitnessGoal?.goalKind || "general_fitness",
          goalCustomText: p.fitnessGoal?.customText || "",
        }));
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "Failed to load profile");
      }
    })();
  }, [member]);

  const bmi = useMemo(() => {
    const h = Number(form.heightCm) / 100;
    const w = Number(form.weightKg);
    if (!h || !w) return "";
    return Math.round((w / (h * h)) * 10) / 10;
  }, [form.heightCm, form.weightKg]);

  if (!member) {
    return (
      <p className="py-12 text-neutral-400">
        <Link to="/member/login" className="text-gray-900 hover:underline">
          Sign in
        </Link>
      </p>
    );
  }

  return (
    <div>
      <MemberPage
        eyebrow="Account"
        title="Profile"
        subtitle="Personal details & health info."
        right={
          <div className="flex gap-2">
            <SoftButton
              type="button"
              onClick={() => {
                setMsg("");
                setErr("");
                setEditing((v) => !v);
              }}
            >
              {editing ? "Cancel" : "Edit"}
            </SoftButton>
            <SoftButton type="button" onClick={() => logout()}>
              Sign out
            </SoftButton>
          </div>
        }
      />

      <div className="max-w-6xl mx-auto">
        {err && <p className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{err}</p>}
        {msg && <p className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{msg}</p>}

        {!editing ? (
          <BentoGrid>
            <BentoCard className="md:col-span-5" tone="lilac" title="Signed in as" subtitle={member.email}>
              <div className="text-sm text-gray-700">
                Keep your phone number updated so we can reach you.
              </div>
              <div className="mt-4">
                <Link to="/member/join" className="text-sm font-semibold text-gray-900/90 hover:underline">
                  Join the gym →
                </Link>
              </div>
            </BentoCard>

            <BentoCard className="md:col-span-7" tone="peach" title="Personal" subtitle="Basics & address">
              <div className="grid gap-2 text-sm">
                <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Name</span><span className="font-medium">{data?.member?.name || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Phone</span><span className="font-medium">{data?.member?.phone || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-gray-500">Gender</span><span className="font-medium">{data?.member?.gender || "—"}</span></div>
                <div className="flex items-center justify-between gap-3"><span className="text-gray-500">DOB</span><span className="font-medium">{data?.member?.dob ? String(data.member.dob).slice(0, 10) : "—"}</span></div>
                <div className="pt-2 text-xs text-gray-600">
                  <span className="font-semibold text-gray-800">Address:</span>{" "}
                  {data?.member?.address?.city || ""}{data?.member?.address?.state ? `, ${data.member.address.state}` : ""}{data?.member?.address?.line1 ? `, ${data.member.address.line1}` : ""}
                </div>
              </div>
            </BentoCard>

            <BentoCard className="md:col-span-12" tone="mint" title="Health" subtitle="Measurements & goals">
              <div className="grid gap-3 md:grid-cols-3 text-sm">
                <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                  <div className="text-xs text-gray-600">Height</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{data?.profile?.heightCm ?? "—"} <span className="text-sm font-semibold text-gray-600">cm</span></div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                  <div className="text-xs text-gray-600">Weight</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{data?.profile?.weightKg ?? "—"} <span className="text-sm font-semibold text-gray-600">kg</span></div>
                </div>
                <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3">
                  <div className="text-xs text-gray-600">BMI</div>
                  <div className="mt-1 text-lg font-extrabold text-gray-900">{data?.profile?.bmi ?? "—"}</div>
                </div>
                <div className="md:col-span-3 grid gap-2 pt-2 text-sm">
                  <div><span className="text-gray-600">Blood group:</span> <span className="font-semibold">{data?.profile?.bloodGroup || "—"}</span></div>
                  <div><span className="text-gray-600">Medical:</span> <span className="font-semibold">{data?.profile?.medicalCondition?.has ? `Yes (${data.profile.medicalCondition.details})` : "No/—"}</span></div>
                  <div><span className="text-gray-600">Goal:</span> <span className="font-semibold">{data?.profile?.fitnessGoal?.goalKind || "—"} {data?.profile?.fitnessGoal?.customText ? `(${data.profile.fitnessGoal.customText})` : ""}</span></div>
                </div>
              </div>
            </BentoCard>
          </BentoGrid>
        ) : (
          <form
            className="mt-6"
            onSubmit={async (e) => {
              e.preventDefault();
              setMsg("");
              setErr("");
              try {
                const payload = {
                  name: form.name || undefined,
                  phone: form.phone || undefined,
                  gender: form.gender || undefined,
                  dob: form.dob ? new Date(form.dob) : undefined,
                  address: { city: form.city || undefined, state: form.state || undefined, line1: form.line1 || undefined },
                  heightCm: form.heightCm === "" ? undefined : Number(form.heightCm),
                  weightKg: form.weightKg === "" ? undefined : Number(form.weightKg),
                  bloodGroup: form.bloodGroup || undefined,
                  medicalHas: Boolean(form.medicalHas),
                  medicalDetails: form.medicalDetails || undefined,
                  injuries: form.injuries || undefined,
                  allergies: form.allergies || undefined,
                  goalKind: form.goalKind || undefined,
                  goalCustomText: form.goalCustomText || undefined,
                };
                const { data } = await memberApi.patch("/member/auth/profile", payload);
                setData(data);
                setEditing(false);
                setMsg("Profile updated.");
              } catch (e) {
                setErr(e?.response?.data?.message || e.message || "Failed to update profile");
              }
            }}
          >
            <BentoGrid>
              <BentoCard className="md:col-span-6" tone="peach" title="Personal" subtitle="Basics & address">
                <div className="grid gap-3">
                  <label className="text-xs text-gray-600">
                    Full name
                    <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                  </label>
                  <label className="text-xs text-gray-600">
                    Phone
                    <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                  </label>
                  <label className="text-xs text-gray-600">
                    Gender
                    <select className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer_not_say">Prefer not to say</option>
                    </select>
                  </label>
                  <label className="text-xs text-gray-600">
                    Date of birth
                    <input type="date" className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-600">
                      City
                      <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-600">
                      State
                      <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} />
                    </label>
                  </div>
                  <label className="text-xs text-gray-600">
                    Address line
                    <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.line1} onChange={(e) => setForm({ ...form, line1: e.target.value })} />
                  </label>
                </div>
              </BentoCard>

              <BentoCard className="md:col-span-6" tone="mint" title="Health" subtitle="Measurements & goals">
                <div className="grid gap-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-600">
                      Height (cm)
                      <input type="number" className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.heightCm} onChange={(e) => setForm({ ...form, heightCm: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-600">
                      Weight (kg)
                      <input type="number" className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.weightKg} onChange={(e) => setForm({ ...form, weightKg: e.target.value })} />
                    </label>
                  </div>
                  <div className="text-xs text-gray-600">BMI (auto): <span className="font-semibold text-gray-900">{bmi || "—"}</span></div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="text-xs text-gray-600">
                      Blood group
                      <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.bloodGroup} onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })} />
                    </label>
                    <label className="text-xs text-gray-600">
                      Goal
                      <select className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.goalKind} onChange={(e) => setForm({ ...form, goalKind: e.target.value })}>
                        <option value="weight_loss">Weight loss</option>
                        <option value="weight_gain">Weight gain</option>
                        <option value="muscle_building">Muscle building</option>
                        <option value="general_fitness">General fitness</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                  </div>
                  {form.goalKind === "other" && (
                    <label className="text-xs text-gray-600">
                      Goal details
                      <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.goalCustomText} onChange={(e) => setForm({ ...form, goalCustomText: e.target.value })} />
                    </label>
                  )}

                  <label className="flex items-center gap-2 text-xs text-gray-700">
                    <input className="h-4 w-4 rounded border-black/20" type="checkbox" checked={form.medicalHas} onChange={(e) => setForm({ ...form, medicalHas: e.target.checked })} />
                    Any medical condition
                  </label>
                  {form.medicalHas && (
                    <label className="text-xs text-gray-600">
                      Medical details
                      <textarea className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" rows={2} value={form.medicalDetails} onChange={(e) => setForm({ ...form, medicalDetails: e.target.value })} />
                    </label>
                  )}
                  <label className="text-xs text-gray-600">
                    Injuries
                    <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.injuries} onChange={(e) => setForm({ ...form, injuries: e.target.value })} />
                  </label>
                  <label className="text-xs text-gray-600">
                    Allergies
                    <input className="mt-1 w-full rounded-2xl border border-black/10 bg-white/80 px-3 py-2 text-gray-900 outline-none focus:ring-2 focus:ring-black/10" value={form.allergies} onChange={(e) => setForm({ ...form, allergies: e.target.value })} />
                  </label>
                </div>
              </BentoCard>

              <div className="md:col-span-12 flex justify-end gap-2">
                <button type="button" onClick={() => setEditing(false)} className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm font-semibold text-gray-900 hover:bg-white">
                  Cancel
                </button>
                <button type="submit" className="rounded-2xl bg-gray-900 px-4 py-3 text-sm font-extrabold text-white hover:bg-black">
                  Save
                </button>
              </div>
            </BentoGrid>
          </form>
        )}
      </div>
    </div>
  );
}
