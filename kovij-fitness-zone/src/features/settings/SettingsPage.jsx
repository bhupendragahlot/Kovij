import { Suspense, useEffect, useMemo, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useSelector } from "react-redux";
import { useSettings, useUpdateSettings } from "./api";
import { StaffSection } from "./StaffSection";
import { MyAccountSection } from "./MyAccountSection";
import { can, usePermission } from "../auth/permissions";
import { selectRole } from "../auth/sessionSlice";
import { SETTINGS_SECTIONS } from "./settingsExtensions";
import { useThemeControls } from "../../app/theme";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Button,
  Card,
  CardHeader,
  ErrorState,
  Field,
  FormError,
  InlineAlert,
  Input,
  PageHeader,
  SegmentedControl,
  SkeletonList,
  Tabs,
  Textarea,
  useToast,
} from "../../shared/ui";

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
    { value: "account", label: "My account" },
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
        {tab === "account" && <MyAccountSection />}
        {tab === "appearance" && <AppearanceSection />}
      </div>
    </>
  );
}
