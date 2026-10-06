import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, KeyRound, LogOut, MapPin, MessageCircle, Monitor, Moon, Pencil, Phone, Sun } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useMemberAuth } from "../../../context/MemberAuthContext";
import { MEMBER_NAV } from "../nav";
import { useChangePassword, useGym, useMyProfile, useNotificationPrefs, useUpdatePrefs, useUpdateProfile } from "../queries";
import { DAY_NAMES, WEEK_ORDER, formatClock, normaliseWeek } from "../../settings/hours";
import { useThemeControls } from "../../../app/theme";
import { Avatar, Button, Card, CardHeader, Dialog, ErrorState, Field, FormError, Input, PageHeader, SegmentedControl, Select, SkeletonList, Switch, useConfirm, useToast } from "../../../shared/ui";
import { formatDate, formatPhone, gymDayKey, phoneHref } from "../../../shared/lib/format";
import { PASS_STORAGE_KEY } from "./PassPage";

const PREFS = [
  { key: "email", label: "Emails", description: "Reminders and replies also come by email." },
  { key: "push", label: "Phone notifications", description: "Alerts on this phone when the app is installed." },
  { key: "announcements", label: "Gym news", description: "Events, offers and holiday timings." },
  { key: "workoutUpdates", label: "Workout and diet updates", description: "When your trainer gives or changes a plan." },
  { key: "birthday", label: "Birthday wishes", description: "A note from the gym on your birthday." },
];

/** Sign out: confirm, clear this phone's member data (cached screens, saved pass), back to sign-in. */
function useSignOut() {
  const { logout } = useMemberAuth();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const navigate = useNavigate();
  return async () => {
    const ok = await confirm({ title: "Sign out?", body: "Your check-in pass is removed from this phone. Sign in again to get it back.", confirmLabel: "Sign out" });
    if (!ok) return;
    try {
      localStorage.removeItem(PASS_STORAGE_KEY);
    } catch {
      /* ignore */
    }
    await logout();
    queryClient.removeQueries({ queryKey: ["me"] });
    navigate("/member/login", { replace: true });
  };
}

export default function ProfilePage() {
  const profile = useMyProfile();
  const signOut = useSignOut();
  const [editing, setEditing] = useState(false);
  const m = profile.data?.member;

  return (
    <>
      <PageHeader title="Profile" />
      <div className="flex flex-col gap-4">
        {profile.isPending ? (
          <Card><SkeletonList rows={2} /></Card>
        ) : profile.isError ? (
          <Card><ErrorState error={profile.error} onRetry={() => profile.refetch()} /></Card>
        ) : (
          <Card className="flex flex-wrap items-center gap-4">
            <Avatar name={m.name} src={m.profilePhoto} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[19px] font-bold">{m.name}</p>
              <p className="text-[13px] text-ink-3">
                {m.memberCode && <span className="tabular font-semibold tracking-wide">{m.memberCode}</span>}
                {m.joinedAt && ` · member since ${formatDate(m.joinedAt)}`}
              </p>
              <p className="truncate text-[13px] text-ink-3">{[formatPhone(m.phone), m.email].filter(Boolean).join(" · ")}</p>
            </div>
            <Button variant="secondary" icon={Pencil} onClick={() => setEditing(true)}>
              Edit
            </Button>
          </Card>
        )}
        {profile.data && <PasswordCard appPassword={profile.data.appPassword} />}
        <NotificationSettings />
        <Appearance />
        <GymDetails />
        <Button variant="secondary" size="lg" block icon={LogOut} onClick={signOut}>
          Sign out
        </Button>
      </div>
      {editing && m && <EditDetails member={m} onClose={() => setEditing(false)} />}
    </>
  );
}

function EditDetails({ member, onClose }) {
  const update = useUpdateProfile();
  const { refreshMember } = useMemberAuth();
  const toast = useToast();
  const [form, setForm] = useState({ name: member.name || "", gender: member.gender || "", dob: member.dob ? member.dob.slice(0, 10) : "" });
  const errors = update.error?.fields || {};
  const submit = (e) => {
    e.preventDefault();
    const patch = { name: form.name.trim(), ...(form.gender && { gender: form.gender }), ...(form.dob && { dob: form.dob }) };
    update.mutate(patch, { onSuccess: () => (refreshMember(), toast.success("Details saved"), onClose()) });
  };
  return (
    <Dialog
      open
      onClose={onClose}
      title="Your details"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="member-details" variant="primary" loading={update.isPending}>
            Save
          </Button>
        </>
      }
    >
      <form id="member-details" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormError error={Object.keys(errors).length ? null : update.error} />
        <Field label="Name" error={errors.name}>
          <Input value={form.name} autoComplete="name" onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Date of birth" optional error={errors.dob} hint="The gym sends you a birthday wish.">
          <Input type="date" max={gymDayKey()} value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
        </Field>
        <Field label="Gender" optional error={errors.gender}>
          <Select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
            <option value="">Prefer not to say</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </Select>
        </Field>
        <p className="text-[13px] text-ink-3">To change your phone number or email, ask at the desk.</p>
      </form>
    </Dialog>
  );
}

const EMPTY_PASSWORDS = { currentPassword: "", newPassword: "", confirmPassword: "" };

/** Change the app password (current, new, confirm), or set a first one if there's none yet. */
function PasswordCard({ appPassword }) {
  const change = useChangePassword();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [show, setShow] = useState(false);
  const [form, setForm] = useState(EMPTY_PASSWORDS);
  const [clientErrors, setClientErrors] = useState({});
  const hasPassword = Boolean(appPassword?.set);
  const errors = { ...(change.error?.fields || {}), ...clientErrors };
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const close = () => {
    setOpen(false);
    setForm(EMPTY_PASSWORDS);
    setClientErrors({});
    change.reset();
  };

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (hasPassword && !form.currentPassword) next.currentPassword = "Enter your current password";
    if (form.newPassword.length < 8) next.newPassword = "Use at least 8 characters.";
    if (form.confirmPassword !== form.newPassword) next.confirmPassword = "The two new passwords don’t match.";
    setClientErrors(next);
    if (Object.keys(next).length) return;
    change.mutate(
      { ...(hasPassword && { currentPassword: form.currentPassword }), newPassword: form.newPassword, confirmPassword: form.confirmPassword },
      {
        onSuccess: () => {
          toast.success(hasPassword ? "Password changed" : "Password set", { description: "Any other phone signed in to your account has been signed out." });
          close();
        },
      }
    );
  };

  const status = !hasPassword
    ? "You sign in with a code sent to your mobile. Add a password to sign in with it too."
    : appPassword.isDefault
      ? "You’re still using your date of birth. Change it so only you can sign in."
      : `Last changed ${formatDate(appPassword.setAt)}.`;

  return (
    <Card>
      <CardHeader
        title="Password"
        description={status}
        action={
          !open && (
            <Button variant={appPassword?.isDefault ? "primary" : "secondary"} icon={KeyRound} onClick={() => setOpen(true)}>
              {hasPassword ? "Change" : "Set password"}
            </Button>
          )
        }
      />
      {open && (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError error={Object.keys(change.error?.fields || {}).length ? null : change.error} />
          {hasPassword && (
            <Field label="Current password" error={errors.currentPassword} hint={appPassword.isDefault ? "Your date of birth, like 15081995." : undefined}>
              <Input type={show ? "text" : "password"} autoComplete="current-password" value={form.currentPassword} onChange={set("currentPassword")} />
            </Field>
          )}
          <Field label="New password" error={errors.newPassword} hint="At least 8 characters. Not your date of birth or mobile number.">
            <Input type={show ? "text" : "password"} autoComplete="new-password" value={form.newPassword} onChange={set("newPassword")} />
          </Field>
          <Field label="Confirm new password" error={errors.confirmPassword}>
            <Input type={show ? "text" : "password"} autoComplete="new-password" value={form.confirmPassword} onChange={set("confirmPassword")} />
          </Field>
          <Switch label="Show passwords" checked={show} onChange={setShow} />
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={change.isPending}>
              {hasPassword ? "Change password" : "Set password"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function NotificationSettings() {
  const prefs = useNotificationPrefs();
  const update = useUpdatePrefs();
  const toast = useToast();
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (prefs.data) setLocal(prefs.data.preferences);
  }, [prefs.data]);

  const toggle = (key, value) => {
    setLocal((p) => ({ ...p, [key]: value }));
    update.mutate({ [key]: value }, { onError: (e) => (setLocal(prefs.data.preferences), toast.error("Couldn't save", { description: e.message })) });
  };

  return (
    <Card>
      <CardHeader title="Notifications" description={prefs.data?.note || "Plan and payment reminders always reach you."} />
      {!local ? (
        <SkeletonList rows={3} />
      ) : (
        <div className="flex flex-col gap-4">
          {PREFS.map((p) => (
            <Switch key={p.key} label={p.label} description={p.description} checked={local[p.key] !== false} onChange={(v) => toggle(p.key, v)} />
          ))}
        </div>
      )}
    </Card>
  );
}

function Appearance() {
  const { preference, setTheme } = useThemeControls();
  return (
    <Card>
      <CardHeader title="Appearance" />
      <SegmentedControl
        label="Theme"
        value={preference}
        onChange={setTheme}
        options={[
          { value: "light", label: "Light", icon: Sun },
          { value: "dark", label: "Dark", icon: Moon },
          { value: "system", label: "Phone setting", icon: Monitor },
        ]}
      />
    </Card>
  );
}

function GymDetails() {
  const gym = useGym().data;
  if (!gym) return null;
  const week = normaliseWeek(gym.openingHours);
  const today = gymDayKey();
  const holidays = (gym.holidays || []).filter((h) => h.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 4);
  const tel = phoneHref(gym.phone);
  const wa = phoneHref(gym.whatsapp || gym.phone, "whatsapp");
  return (
    <Card>
      <CardHeader title="Gym details" description={gym.gymName} />
      <div className="flex flex-col gap-4 text-[15px]">
        {gym.address && (
          <p className="flex gap-2">
            <MapPin className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden />
            {gym.address}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {tel && (
            <a href={tel} className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">
              <Phone className="size-4" aria-hidden />
              Call {formatPhone(gym.phone)}
            </a>
          )}
          {wa && (
            <a href={wa} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-full border border-line-strong px-4 text-sm font-semibold hover:bg-surface-2">
              <MessageCircle className="size-4" aria-hidden />
              WhatsApp
            </a>
          )}
        </div>
        <div>
          <h3 className="mb-2 text-[13px] font-bold text-ink-3">Opening hours</h3>
          <dl className="grid grid-cols-[6rem_1fr] gap-y-1 text-sm">
            {WEEK_ORDER.map((d) => (
              <div key={d} className="contents">
                <dt className="text-ink-2">{DAY_NAMES[d]}</dt>
                <dd className="tabular">{week[d].closed || !week[d].slots.length ? "Closed" : week[d].slots.map((s) => `${formatClock(s.open)} – ${formatClock(s.close)}`).join(", ")}</dd>
              </div>
            ))}
          </dl>
        </div>
        {holidays.length > 0 && (
          <div>
            <h3 className="mb-2 text-[13px] font-bold text-ink-3">Coming holidays</h3>
            <ul className="text-sm">
              {holidays.map((h) => (
                <li key={h.date}>
                  {formatDate(`${h.date}T12:00:00+05:30`)}: {h.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

/** /member/more: everything that isn't in the phone's bottom bar. */
export function MorePage() {
  const signOut = useSignOut();
  const { member } = useMemberAuth();
  const items = MEMBER_NAV.filter((n) => !n.tab);
  return (
    <>
      <PageHeader title="More" />
      <Card padding="none" className="mb-4 overflow-hidden">
        <Link to="/member/profile" className="flex items-center gap-3 p-4 hover:bg-surface-2">
          <Avatar name={member?.name || ""} src={member?.profilePhoto} />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{member?.name}</span>
            <span className="block text-[13px] text-ink-3">Profile and settings</span>
          </span>
          <ChevronRight className="size-5 text-ink-3" aria-hidden />
        </Link>
      </Card>
      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-line">
          {items
            .filter((i) => i.to !== "/member/profile")
            .map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="flex h-14 items-center gap-3 px-4 hover:bg-surface-2">
                  <i.icon className="size-5 text-ink-2" aria-hidden />
                  <span className="flex-1 font-semibold">{i.label}</span>
                  <ChevronRight className="size-5 text-ink-3" aria-hidden />
                </Link>
              </li>
            ))}
        </ul>
      </Card>
      <Button variant="ghost" block icon={LogOut} className="mt-4" onClick={signOut}>
        Sign out
      </Button>
    </>
  );
}
