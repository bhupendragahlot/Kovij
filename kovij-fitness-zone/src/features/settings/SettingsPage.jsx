import { Suspense, useEffect, useMemo, useState } from "react";
import { KeyRound, Monitor, Moon, Plus, Sun, UserRoundX, UserRoundCheck } from "lucide-react";
import { useSelector } from "react-redux";
import { useSaveStaff, useSettings, useStaff, useUpdateSettings } from "./api";
import { can, usePermission } from "../auth/permissions";
import { selectRole, selectStaffUser } from "../auth/sessionSlice";
import { SETTINGS_SECTIONS } from "./settingsExtensions";
import { useThemeControls } from "../../app/theme";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  Dialog,
  ErrorState,
  Field,
  FormError,
  InlineAlert,
  Input,
  PageHeader,
  SegmentedControl,
  Select,
  SkeletonList,
  Tabs,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatRelativeTime } from "../../shared/lib/format";
import { ROLE_LABEL } from "../../shared/domain/status";

const GYM_FIELDS = [
  { key: "gymName", label: "Gym name", hint: "Used on receipts and emails." },
  { key: "invoicePrefix", label: "Receipt prefix", hint: "Letters only, e.g. KFZ gives KFZ-2026-00042.", transform: (v) => v.toUpperCase() },
  { key: "registrationFee", label: "Registration fee", type: "number", prefix: "₹", hint: "Added to a member's first plan. Use 0 for none." },
  { key: "expiringWindowDays", label: "“Ending soon” window", type: "number", suffix: "days", hint: "How early plans show up for renewal on Today." },
];

const WEBSITE_FIELDS = [
  { key: "heroHeadline", label: "Headline", span: 2 },
  { key: "heroDescription", label: "Intro text", type: "textarea", span: 2 },
  { key: "heroBackgroundImage", label: "Background image link", type: "url", span: 2 },
  { key: "phone", label: "Phone", type: "tel" },
  { key: "whatsapp", label: "WhatsApp number", type: "tel", hint: "With country code, e.g. 919057027053." },
  { key: "email", label: "Email", type: "email", hint: "Website enquiries are also sent here." },
  { key: "address", label: "Address" },
  { key: "instagram", label: "Instagram link", type: "url" },
  { key: "facebook", label: "Facebook link", type: "url" },
  { key: "mapEmbedUrl", label: "Google Maps embed link", type: "url", span: 2 },
];

/** Config-driven settings form: renders fields, tracks changes, PATCHes only what changed. */
function SettingsForm({ fields, settings, readOnly }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const initial = useMemo(() => Object.fromEntries(fields.map((f) => [f.key, settings[f.key] ?? ""])), [fields, settings]);
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);

  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => String(v) !== String(initial[k])));
  const dirty = Object.keys(changed).length > 0;
  const errors = update.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const patch = Object.fromEntries(
      Object.entries(changed).map(([k, v]) => [k, fields.find((f) => f.key === k)?.type === "number" ? Number(v) : v])
    );
    update.mutate(patch, { onSuccess: () => toast.success("Settings saved") });
  };

  return (
    <form onSubmit={submit} noValidate>
      <FormError error={update.error} />
      <fieldset disabled={readOnly} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <Field key={f.key} label={f.label} hint={f.hint} error={errors[f.key]} className={f.span === 2 ? "sm:col-span-2" : undefined}>
            {f.type === "textarea" ? (
              <Textarea value={form[f.key]} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} rows={3} />
            ) : (
              <Input
                type={f.type || "text"}
                inputMode={f.type === "number" ? "numeric" : undefined}
                prefix={f.prefix}
                suffix={f.suffix}
                value={form[f.key]}
                onChange={(e) => setForm({ ...form, [f.key]: f.transform ? f.transform(e.target.value) : e.target.value })}
              />
            )}
          </Field>
        ))}
      </fieldset>
      {!readOnly && (
        <div className="mt-5 flex justify-end gap-2">
          {dirty && (
            <Button variant="ghost" onClick={() => setForm(initial)}>
              Undo changes
            </Button>
          )}
          <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      )}
    </form>
  );
}

function randomPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

function StaffDialog({ open, staff, onClose }) {
  const save = useSaveStaff();
  const toast = useToast();
  const [form, setForm] = useState({ name: "", username: "", email: "", role: "staff", password: "" });
  useEffect(() => {
    if (!open) return;
    save.reset();
    setForm(staff ? { name: staff.name, username: staff.username, email: staff.email, role: staff.role, password: "" } : { name: "", username: "", email: "", role: "staff", password: randomPassword() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const errors = save.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = staff ? { name: form.name, role: form.role, ...(form.password && { password: form.password }) } : form;
    save.mutate(
      { id: staff?.id, payload },
      {
        onSuccess: () => {
          toast.success(staff ? "Staff account updated" : `${form.name} can now sign in`, {
            description: form.password ? "Share the temporary password in person, not over chat." : undefined,
          });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={staff ? `Edit ${staff.name}` : "Add staff account"}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="staff-form" variant="primary" loading={save.isPending}>
            {staff ? "Save" : "Create account"}
          </Button>
        </>
      }
    >
      <FormError error={save.error} />
      <form id="staff-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" error={errors.name} required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} />
        </Field>
        {!staff && (
          <>
            <Field label="Email" error={errors.email} required hint="They sign in with this.">
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Username" error={errors.username} required>
              <Input value={form.username} onChange={(e) => set({ username: e.target.value })} autoCapitalize="none" />
            </Field>
          </>
        )}
        <Field label="Role" error={errors.role} className="sm:col-span-2" hint="Front desk: check-ins and payments. Manager: also prices, plans, revenue and campaigns. Owner: everything.">
          <Select value={form.role} onChange={(e) => set({ role: e.target.value })}>
            {Object.entries(ROLE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label={staff ? "New password" : "Temporary password"}
          optional={Boolean(staff)}
          error={errors.password}
          className="sm:col-span-2"
          hint={staff ? "Leave blank to keep their current password." : "At least 8 characters. Ask them to change it after first sign-in."}
          labelAction={
            <button type="button" onClick={() => set({ password: randomPassword() })} className="text-[13px] font-semibold text-brand-ink hover:underline">
              Generate
            </button>
          }
        >
          <Input value={form.password} onChange={(e) => set({ password: e.target.value })} autoComplete="new-password" className="tabular" />
        </Field>
      </form>
    </Dialog>
  );
}

function StaffSection() {
  const staff = useStaff();
  const save = useSaveStaff();
  const me = useSelector(selectStaffUser);
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const toggleActive = async (s) => {
    if (s.isActive) {
      const ok = await confirm({ title: `Deactivate ${s.name}?`, body: "They are signed out and can't sign in until reactivated.", confirmLabel: "Deactivate", tone: "danger" });
      if (!ok) return;
    }
    save.mutate(
      { id: s.id, payload: { isActive: !s.isActive } },
      { onSuccess: () => toast.success(s.isActive ? `${s.name} deactivated` : `${s.name} reactivated`), onError: (e) => toast.error("Couldn't update", { description: e.message }) }
    );
  };

  return (
    <Card padding="lg">
      <CardHeader title="Staff accounts" description="Who can sign in to the desk app." action={<Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>Add staff</Button>} />
      {staff.isPending ? (
        <SkeletonList rows={3} />
      ) : staff.isError ? (
        <ErrorState compact error={staff.error} onRetry={() => staff.refetch()} />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {staff.data.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-3 rounded-tile px-2 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {s.name} {s.id === me?.id && <span className="font-normal text-ink-3">(you)</span>}
                </p>
                <p className="truncate text-[13px] text-ink-3">
                  {s.email}, {s.lastLoginAt ? `last signed in ${formatRelativeTime(s.lastLoginAt)}` : "never signed in"}
                </p>
              </div>
              <Badge size="sm" tone={s.role === "admin" ? "brand" : "neutral"}>
                {ROLE_LABEL[s.role]}
              </Badge>
              {!s.isActive && <Badge size="sm" tone="bad">Deactivated</Badge>}
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" icon={KeyRound} onClick={() => setEditing(s)}>
                  Edit
                </Button>
                {s.id !== me?.id && (
                  <Button size="sm" variant="ghost" icon={s.isActive ? UserRoundX : UserRoundCheck} onClick={() => toggleActive(s)}>
                    {s.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      <StaffDialog open={creating || Boolean(editing)} staff={editing} onClose={() => (setCreating(false), setEditing(null))} />
    </Card>
  );
}

function AppearanceSection() {
  const { preference, setTheme } = useThemeControls();
  return (
    <Card padding="lg">
      <CardHeader title="Appearance" description="Applies to this device only." />
      <SegmentedControl
        label="Theme"
        value={preference}
        onChange={setTheme}
        options={[
          { value: "light", label: "Light", icon: Sun },
          { value: "dark", label: "Dark", icon: Moon },
          { value: "system", label: "Match device", icon: Monitor },
        ]}
      />
    </Card>
  );
}

const DEFAULTS = { tab: "gym" };

export default function SettingsPage() {
  const [{ tab }, setUrl] = useUrlState(DEFAULTS);
  const settings = useSettings();
  const canManage = usePermission("settings.manage");
  const canManageStaff = usePermission("staff.manage");

  const role = useSelector(selectRole);
  const sections = SETTINGS_SECTIONS.filter((s) => can(role, s.permission));
  const section = sections.find((s) => s.value === tab);

  const tabs = [
    { value: "gym", label: "Gym and billing" },
    { value: "website", label: "Website" },
    ...sections.map(({ value, label }) => ({ value, label })),
    canManageStaff && { value: "staff", label: "Staff" },
    { value: "appearance", label: "Appearance" },
  ].filter(Boolean);

  return (
    <>
      <PageHeader title="Settings" />
      <Tabs label="Settings sections" value={tab} onChange={(t) => setUrl({ tab: t })} tabs={tabs} className="mb-5" />
      <div className="max-w-3xl" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {!canManage && (tab === "gym" || tab === "website") && (
          <InlineAlert tone="info" className="mb-4">
            Only the owner can change these settings.
          </InlineAlert>
        )}
        {(tab === "gym" || tab === "website") &&
          (settings.isPending ? (
            <Card><SkeletonList rows={4} /></Card>
          ) : settings.isError ? (
            <Card><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Card>
          ) : (
            <Card padding="lg">
              <SettingsForm fields={tab === "gym" ? GYM_FIELDS : WEBSITE_FIELDS} settings={settings.data} readOnly={!canManage} />
            </Card>
          ))}
        {section &&
          (settings.isPending ? (
            <Card><SkeletonList rows={4} /></Card>
          ) : settings.isError ? (
            <Card><ErrorState error={settings.error} onRetry={() => settings.refetch()} /></Card>
          ) : (
            <Suspense fallback={<Card><SkeletonList rows={4} /></Card>}>
              <section.Component settings={settings.data} readOnly={!canManage} />
            </Suspense>
          ))}
        {tab === "staff" && canManageStaff && <StaffSection />}
        {tab === "appearance" && <AppearanceSection />}
      </div>
    </>
  );
}
