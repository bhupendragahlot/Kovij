import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { memberApi } from "../../lib/memberApi";
import { useMemberAuth } from "../../context/MemberAuthContext";
import GoogleSignInButton from "../../components/member/GoogleSignInButton";

const steps = ["Personal", "Health", "Goals", "Plan & pay", "Uploads", "Review"];
const base = import.meta.env.VITE_API_BASE_URL || "";

function clsx(...parts) {
  return parts.filter(Boolean).join(" ");
}

function isNonEmpty(v) {
  return String(v || "").trim().length > 0;
}

function isEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
}

function fmtPlanLabel(p) {
  if (!p) return "";
  const dur = p.durationInDays ? `${p.durationInDays} days` : p.duration || "";
  return `${p.name} • ₹${p.price}${dur ? ` • ${dur}` : ""}`;
}

export default function JoinGymForm() {
  const { member, loading } = useMemberAuth();
  const navigate = useNavigate();
  const isJoinGate = window.location.pathname === "/member/join";
  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState(null);

  const [profileFile, setProfileFile] = useState(null);
  const [idFile, setIdFile] = useState(null);
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [idProofUrl, setIdProofUrl] = useState("");

  const [form, setForm] = useState({
    fullName: member?.name || "",
    age: 25,
    gender: "male",
    mobile: "",
    email: member?.email || "",
    city: "",
    state: "",
    line1: "",
    heightCm: 170,
    weightKg: 70,
    bloodGroup: "",
    medicalHas: false,
    medicalDetails: "",
    injuries: "",
    allergies: "",
    goalKind: "general_fitness",
    customText: "",
    selectedPlanId: "",
    registrationFee: 0,
    membershipFee: 0,
    mode: "upi",
    paymentStatus: "pending",
    idProofType: "aadhar",
  });

  const bmi = useMemo(() => {
    const h = form.heightCm / 100;
    if (!h) return 0;
    return Math.round((form.weightKg / (h * h)) * 10) / 10;
  }, [form.heightCm, form.weightKg]);

  const selectedPlan = useMemo(
    () => plans.find((p) => p._id === form.selectedPlanId) || null,
    [plans, form.selectedPlanId]
  );

  const progressPct = useMemo(() => {
    const max = steps.length - 1;
    return Math.round((Math.min(step, max) / max) * 100);
  }, [step]);

  useEffect(() => {
    if (!member) return;
    setForm((f) => ({
      ...f,
      fullName: f.fullName || member.name || "",
      email: f.email || member.email || "",
    }));
  }, [member]);

  // If user already has active membership, go to membership page instead of showing registration form again.
  useEffect(() => {
    if (!member) return;
    (async () => {
      try {
        const { data } = await memberApi.get("/membership/me");
        if (data?.membership?.status === "active") {
          navigate("/member/dashboard", { replace: true });
        }
      } catch {
        // ignore
      }
    })();
  }, [member, navigate]);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get(`${base}/api/plans`);
        const list = data.plans || data || [];
        const normalized = Array.isArray(list) ? list : [];
        setPlans(normalized);
        if (normalized[0]?._id) setForm((f) => ({ ...f, selectedPlanId: normalized[0]._id }));
      } catch {
        setPlans([]);
      } finally {
        setLoadingPlans(false);
      }
    })();
  }, []);

  const uploadFiles = async () => {
    if (!profileFile && !idFile) return;
    const fd = new FormData();
    if (profileFile) fd.append("profilePhoto", profileFile);
    if (idFile) fd.append("idProof", idFile);
    const { data } = await memberApi.post("/member/auth/uploads", fd);
    setProfilePhotoUrl(data.profilePhotoUrl || "");
    setIdProofUrl(data.idProofUrl || "");
  };

  const stepErrors = useMemo(() => {
    const e = {};
    if (step === 0) {
      if (!isNonEmpty(form.fullName)) e.fullName = "Full name is required";
      if (!Number.isFinite(Number(form.age)) || Number(form.age) < 1) e.age = "Enter a valid age";
      if (!isNonEmpty(form.mobile)) e.mobile = "Mobile number is required";
      if (!isEmail(form.email)) e.email = "Enter a valid email";
      if (!isNonEmpty(form.city)) e.city = "City is required";
      if (!isNonEmpty(form.state)) e.state = "State is required";
    }
    if (step === 1) {
      if (!Number.isFinite(Number(form.heightCm)) || Number(form.heightCm) <= 0) e.heightCm = "Height is required";
      if (!Number.isFinite(Number(form.weightKg)) || Number(form.weightKg) <= 0) e.weightKg = "Weight is required";
      if (form.medicalHas && !isNonEmpty(form.medicalDetails)) e.medicalDetails = "Please add medical details";
    }
    if (step === 2) {
      if (form.goalKind === "other" && !isNonEmpty(form.customText)) e.customText = "Please describe your goal";
    }
    if (step === 3) {
      if (!isNonEmpty(form.selectedPlanId)) e.selectedPlanId = "Please select a plan";
      if (Number(form.registrationFee) < 0) e.registrationFee = "Must be 0 or greater";
      if (Number(form.membershipFee) < 0) e.membershipFee = "Must be 0 or greater";
    }
    return e;
  }, [
    step,
    form.fullName,
    form.age,
    form.mobile,
    form.email,
    form.city,
    form.state,
    form.heightCm,
    form.weightKg,
    form.medicalHas,
    form.medicalDetails,
    form.goalKind,
    form.customText,
    form.selectedPlanId,
    form.registrationFee,
    form.membershipFee,
  ]);

  const canGoNext = useMemo(() => {
    if (step >= steps.length - 1) return false;
    if (step === 4) return true; // uploads optional
    return Object.keys(stepErrors).length === 0;
  }, [step, stepErrors]);

  const next = () => {
    if (!canGoNext) {
      setErr("Please complete the required fields before continuing.");
      return;
    }
    setErr(null);
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const prev = () => setStep((s) => Math.max(s - 1, 0));

  const input = (k) => ({
    value: form[k],
    onChange: (e) =>
      setForm({
        ...form,
        [k]: e.target.type === "number" ? Number(e.target.value) : e.target.value,
      }),
  });

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      if (profileFile || idFile) await uploadFiles();

      const body = {
        personalDetails: {
          fullName: form.fullName,
          age: form.age,
          gender: form.gender,
          mobile: form.mobile,
          email: form.email,
          address: { city: form.city, state: form.state, line1: form.line1 },
        },
        healthDetails: {
          heightCm: form.heightCm,
          weightKg: form.weightKg,
          bloodGroup: form.bloodGroup || undefined,
          medicalCondition: { has: form.medicalHas, details: form.medicalDetails },
          injuries: form.injuries,
          allergies: form.allergies,
        },
        fitnessGoal: { goalKind: form.goalKind, customText: form.customText },
        selectedPlanId: form.selectedPlanId,
        payment: {
          registrationFee: Number(form.registrationFee),
          membershipFee: Number(form.membershipFee),
          mode: form.mode,
          status: form.paymentStatus,
        },
        profilePhotoUrl: profilePhotoUrl || undefined,
        idProofUrl: idProofUrl || undefined,
        idProofType: form.idProofType,
      };

      await memberApi.post("/membership/join", body);
      navigate("/member/dashboard");
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || "Failed to join");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    !member ? (
      <div className="kv-container flex min-h-[70vh] flex-col items-center justify-center py-16">
        <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-8 shadow-xl">
          <h1 className="mb-2 text-center font-['Lexend'] text-2xl font-black uppercase text-white">
            Join the gym
          </h1>
          <p className="mb-6 text-center text-sm text-neutral-400">
            Please sign in with Google to create your gym account and continue.
          </p>
          {loading ? (
            <p className="text-center text-sm text-neutral-400">Checking session…</p>
          ) : (
            <div className="flex justify-center">
              <GoogleSignInButton />
            </div>
          )}
          <p className="mt-8 text-center text-xs text-neutral-600">
            <Link to="/" className="text-red-500 hover:underline">
              Back to home
            </Link>
          </p>
        </div>
      </div>
    ) : (
    isJoinGate ? (
      <div className="kv-container py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-neutral-800 bg-neutral-950/80 p-8 text-neutral-200">
          <h1 className="font-['Lexend'] text-2xl font-black uppercase text-white">Account created</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Your member account is ready. Go to your dashboard to view your details and complete membership registration.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link to="/member/dashboard" className="rounded bg-red-600 px-5 py-2 text-sm font-bold text-white hover:bg-red-500">
              Go to dashboard
            </Link>
            <Link to="/member/join/form" className="rounded border border-neutral-700 px-5 py-2 text-sm text-white hover:bg-neutral-900">
              Continue membership form
            </Link>
          </div>
        </div>
      </div>
    ) : (
    <div className="kv-container py-10 sm:py-14">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/80 shadow-2xl">
        <div className="border-b border-neutral-800 bg-black/40 px-6 py-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="font-['Lexend'] text-2xl font-black uppercase text-white">Join the gym</h1>
              <p className="mt-1 text-sm text-neutral-400">
                Step {step + 1} of {steps.length}: <span className="text-neutral-200">{steps[step]}</span>
              </p>
            </div>
            <div className="text-xs text-neutral-400">
              <span className="rounded-full border border-neutral-700 bg-neutral-950/60 px-3 py-1">{progressPct}% complete</span>
            </div>
          </div>
          <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-neutral-800">
            <div className="h-full bg-gradient-to-r from-red-600 to-red-400" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {steps.map((s, idx) => (
              <button
                key={s}
                type="button"
                onClick={() => idx <= step && setStep(idx)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-xs font-semibold transition",
                  idx === step
                    ? "border-red-500 bg-red-600/20 text-red-200"
                    : idx < step
                      ? "border-neutral-700 bg-neutral-950/40 text-neutral-200 hover:border-neutral-500"
                      : "border-neutral-900 bg-neutral-950/20 text-neutral-500"
                )}
                disabled={idx > step}
              >
                {idx + 1}. {s}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-6 md:px-8 md:py-8">
          {err && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-sm text-red-200">{err}</p>}

          {step === 0 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-neutral-400 md:col-span-2">
                Full name
                <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.fullName ? "border-red-600" : "border-neutral-700")} {...input("fullName")} />
                {stepErrors.fullName && <div className="mt-1 text-[11px] text-red-300">{stepErrors.fullName}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                Age
                <input type="number" className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.age ? "border-red-600" : "border-neutral-700")} {...input("age")} />
                {stepErrors.age && <div className="mt-1 text-[11px] text-red-300">{stepErrors.age}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                Gender
                <select className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("gender")}>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                  <option value="prefer_not_say">Prefer not to say</option>
                </select>
              </label>
              <label className="text-xs text-neutral-400">
                Mobile
                <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.mobile ? "border-red-600" : "border-neutral-700")} {...input("mobile")} />
                {stepErrors.mobile && <div className="mt-1 text-[11px] text-red-300">{stepErrors.mobile}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                Email
                <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.email ? "border-red-600" : "border-neutral-700")} {...input("email")} />
                {stepErrors.email && <div className="mt-1 text-[11px] text-red-300">{stepErrors.email}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                City
                <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.city ? "border-red-600" : "border-neutral-700")} {...input("city")} />
                {stepErrors.city && <div className="mt-1 text-[11px] text-red-300">{stepErrors.city}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                State
                <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.state ? "border-red-600" : "border-neutral-700")} {...input("state")} />
                {stepErrors.state && <div className="mt-1 text-[11px] text-red-300">{stepErrors.state}</div>}
              </label>
              <label className="text-xs text-neutral-400 md:col-span-2">
                Address line (optional)
                <input className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("line1")} />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="text-xs text-neutral-400">
                Height (cm)
                <input type="number" className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.heightCm ? "border-red-600" : "border-neutral-700")} {...input("heightCm")} />
                {stepErrors.heightCm && <div className="mt-1 text-[11px] text-red-300">{stepErrors.heightCm}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                Weight (kg)
                <input type="number" className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.weightKg ? "border-red-600" : "border-neutral-700")} {...input("weightKg")} />
                {stepErrors.weightKg && <div className="mt-1 text-[11px] text-red-300">{stepErrors.weightKg}</div>}
              </label>
              <p className="md:col-span-2 text-sm text-neutral-300">
                BMI: <strong>{bmi}</strong>
              </p>
              <label className="text-xs text-neutral-400">
                Blood group (optional)
                <input className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("bloodGroup")} />
              </label>
              <label className="flex items-center gap-2 text-xs text-neutral-400 md:col-span-2">
                <input type="checkbox" checked={form.medicalHas} onChange={(e) => setForm({ ...form, medicalHas: e.target.checked })} />
                Any medical condition
              </label>
              {form.medicalHas && (
                <label className="text-xs text-neutral-400 md:col-span-2">
                  Details
                  <textarea
                    className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.medicalDetails ? "border-red-600" : "border-neutral-700")}
                    rows={2}
                    value={form.medicalDetails}
                    onChange={(e) => setForm({ ...form, medicalDetails: e.target.value })}
                  />
                  {stepErrors.medicalDetails && <div className="mt-1 text-[11px] text-red-300">{stepErrors.medicalDetails}</div>}
                </label>
              )}
              <label className="text-xs text-neutral-400 md:col-span-2">
                Injuries (optional)
                <input className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("injuries")} />
              </label>
              <label className="text-xs text-neutral-400 md:col-span-2">
                Allergies (optional)
                <input className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("allergies")} />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="grid gap-3">
              <label className="text-xs text-neutral-400">
                Fitness goal
                <select className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("goalKind")}>
                  <option value="weight_loss">Weight loss</option>
                  <option value="weight_gain">Weight gain</option>
                  <option value="muscle_building">Muscle building</option>
                  <option value="general_fitness">General fitness</option>
                  <option value="other">Other</option>
                </select>
              </label>
              {form.goalKind === "other" && (
                <label className="text-xs text-neutral-400">
                  Describe goal
                  <input className={clsx("mt-1 w-full rounded border bg-black px-3 py-2 text-white", stepErrors.customText ? "border-red-600" : "border-neutral-700")} {...input("customText")} />
                  {stepErrors.customText && <div className="mt-1 text-[11px] text-red-300">{stepErrors.customText}</div>}
                </label>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="grid gap-4">
              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Membership plan</div>
                  {selectedPlan && <div className="text-xs text-neutral-500">{fmtPlanLabel(selectedPlan)}</div>}
                </div>
                {loadingPlans ? (
                  <p className="mt-2 text-neutral-400">Loading plans…</p>
                ) : plans.length === 0 ? (
                  <p className="mt-2 text-sm text-neutral-400">No plans available right now.</p>
                ) : (
                  <div className={clsx("mt-3 grid gap-3 sm:grid-cols-2", stepErrors.selectedPlanId && "rounded border border-red-700/60 p-3")}>
                    {plans
                      .filter((p) => p.showOnFrontend !== false && p.status !== "Inactive")
                      .map((p) => {
                        const active = p._id === form.selectedPlanId;
                        return (
                          <button
                            key={p._id}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, selectedPlanId: p._id }))}
                            className={clsx(
                              "rounded-xl border p-4 text-left transition",
                              active ? "border-red-500 bg-red-600/10" : "border-neutral-800 bg-neutral-950/40 hover:border-neutral-600"
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-extrabold text-white">{p.name}</div>
                                <div className="mt-1 text-xs text-neutral-400">{p.durationInDays ? `${p.durationInDays} days` : p.duration}</div>
                              </div>
                              <div className="text-sm font-black text-white">₹{p.price}</div>
                            </div>
                            {Array.isArray(p.features) && p.features.length > 0 && (
                              <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-neutral-400">
                                {p.features.slice(0, 3).map((f) => (
                                  <li key={f}>{f}</li>
                                ))}
                                {p.features.length > 3 && <li>+{p.features.length - 3} more</li>}
                              </ul>
                            )}
                            {active && <div className="mt-3 text-xs font-semibold text-red-200">Selected</div>}
                          </button>
                        );
                      })}
                  </div>
                )}
                {stepErrors.selectedPlanId && <div className="mt-2 text-[11px] text-red-300">{stepErrors.selectedPlanId}</div>}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-neutral-400">
                  Registration fee
                  <input type="number" className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("registrationFee")} />
                </label>
                <label className="text-xs text-neutral-400">
                  Membership fee
                  <input type="number" className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("membershipFee")} />
                </label>
                <label className="text-xs text-neutral-400">
                  Payment mode
                  <select className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("mode")}>
                    <option value="cash">Cash</option>
                    <option value="upi">UPI</option>
                    <option value="card">Card</option>
                  </select>
                </label>
                <label className="text-xs text-neutral-400">
                  Payment status
                  <select className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("paymentStatus")}>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-neutral-800 bg-black/30 p-4 text-sm text-neutral-200">
                <div className="flex items-center justify-between">
                  <span className="text-neutral-400">Estimated total</span>
                  <span className="font-extrabold text-white">₹{Number(form.registrationFee || 0) + Number(form.membershipFee || 0)}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-500">You can keep payment status as Pending if paying later.</div>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="grid gap-3">
              <label className="text-xs text-neutral-400">
                ID proof type
                <select className="mt-1 w-full rounded border border-neutral-700 bg-black px-3 py-2 text-white" {...input("idProofType")}>
                  <option value="aadhar">Aadhar</option>
                  <option value="pan">PAN</option>
                  <option value="passport">Passport</option>
                  <option value="driving_license">Driving license</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="text-xs text-neutral-400">
                Profile photo (optional)
                <input type="file" accept="image/*" className="mt-1 w-full text-sm text-neutral-300" onChange={(e) => setProfileFile(e.target.files?.[0] || null)} />
                {profileFile && <div className="mt-1 text-[11px] text-neutral-500">Selected: {profileFile.name}</div>}
              </label>
              <label className="text-xs text-neutral-400">
                ID proof scan (optional)
                <input type="file" accept="image/*,application/pdf" className="mt-1 w-full text-sm text-neutral-300" onChange={(e) => setIdFile(e.target.files?.[0] || null)} />
                {idFile && <div className="mt-1 text-[11px] text-neutral-500">Selected: {idFile.name}</div>}
              </label>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-4 text-xs text-neutral-400">
                Tip: Uploading documents is optional. You can also complete verification at the gym desk.
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="grid gap-4">
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Personal</div>
                <div className="mt-2 grid gap-1 text-sm text-neutral-200">
                  <div>
                    <span className="text-neutral-400">Name:</span> {form.fullName}
                  </div>
                  <div>
                    <span className="text-neutral-400">Age/Gender:</span> {form.age} / {form.gender}
                  </div>
                  <div>
                    <span className="text-neutral-400">Mobile:</span> {form.mobile}
                  </div>
                  <div>
                    <span className="text-neutral-400">Email:</span> {form.email}
                  </div>
                  <div>
                    <span className="text-neutral-400">Address:</span> {form.city}, {form.state}
                    {form.line1 ? `, ${form.line1}` : ""}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Health</div>
                <div className="mt-2 grid gap-1 text-sm text-neutral-200">
                  <div>
                    <span className="text-neutral-400">Height/Weight:</span> {form.heightCm} cm / {form.weightKg} kg
                  </div>
                  <div>
                    <span className="text-neutral-400">BMI:</span> {bmi}
                  </div>
                  <div>
                    <span className="text-neutral-400">Medical:</span> {form.medicalHas ? `Yes (${form.medicalDetails})` : "No"}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-black/30 p-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Plan & payment</div>
                <div className="mt-2 grid gap-1 text-sm text-neutral-200">
                  <div>
                    <span className="text-neutral-400">Plan:</span> {selectedPlan ? fmtPlanLabel(selectedPlan) : form.selectedPlanId}
                  </div>
                  <div>
                    <span className="text-neutral-400">Total fees:</span> ₹{Number(form.registrationFee || 0) + Number(form.membershipFee || 0)}
                  </div>
                  <div>
                    <span className="text-neutral-400">Mode/Status:</span> {form.mode} / {form.paymentStatus}
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-neutral-800 bg-neutral-950/40 p-4 text-sm text-neutral-200">
                <div className="font-semibold text-white">Ready to submit?</div>
                <div className="mt-1 text-xs text-neutral-500">We’ll save your membership and send a confirmation email.</div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-800 pt-6">
            <Link to="/member/membership" className="text-sm text-neutral-500 hover:text-white">
              Skip to status
            </Link>
            <div className="flex gap-2">
              {step > 0 && (
                <button type="button" onClick={() => { setErr(null); prev(); }} className="rounded border border-neutral-700 px-4 py-2 text-sm text-white hover:bg-neutral-900">
                  Back
                </button>
              )}
              {step < steps.length - 1 && (
                <button
                  type="button"
                  onClick={next}
                  disabled={!canGoNext}
                  className="rounded bg-red-600 px-5 py-2 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-50"
                >
                  Next
                </button>
              )}
              {step === steps.length - 1 && (
                <button
                  type="button"
                  disabled={submitting}
                  onClick={submit}
                  className="rounded bg-red-600 px-5 py-2 text-sm font-extrabold uppercase tracking-widest text-white hover:bg-red-500 disabled:opacity-50"
                >
                  {submitting ? "Submitting…" : "Submit"}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
    ))
  );
}
