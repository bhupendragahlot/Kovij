import { useEffect, useState } from "react";
import { Lock, Mail, Pencil, Plus, UserRoundCheck, UserRoundX } from "lucide-react";
import { useSelector } from "react-redux";
import { useSaveStaff, useSendResetLink, useStaff } from "./api";
import { selectStaffUser } from "../auth/sessionSlice";
import { RoleMatrix } from "./RoleMatrix";
import { Badge, Button, Card, CardHeader, Dialog, ErrorState, Field, FormError, Input, Select, SkeletonList, useConfirm, useToast } from "../../shared/ui";
import { formatRelativeTime } from "../../shared/lib/format";
import { ROLE_LABEL } from "../../shared/domain/status";

const ROLE_HINT = {
  admin: "Everything, including settings, staff and the activity log.",
  manager: "Runs the business: money, plans, reports, campaigns, freezes and refunds.",
  staff: "Front desk: members, check-ins, collecting payments and enquiries.",
  trainer: "Coaching: workouts, diets, progress and notes. No money or settings.",
};

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
            <Field label="Email" error={errors.email} required hint="They sign in with this, and reset links go here.">
              <Input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
            </Field>
            <Field label="Username" error={errors.username} required>
              <Input value={form.username} onChange={(e) => set({ username: e.target.value })} autoCapitalize="none" />
            </Field>
          </>
        )}
        <Field label="Role" error={errors.role} className="sm:col-span-2" hint={ROLE_HINT[form.role]}>
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
          hint={
            staff
              ? "Leave blank to keep their password. Setting one signs them out everywhere; sending a reset link is usually better."
              : "At least 8 characters. Ask them to change it in Settings, My account after signing in."
          }
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

/** OWNER: security module. Settings > Staff. */
export function StaffSection() {
  const staff = useStaff();
  const save = useSaveStaff();
  const sendLink = useSendResetLink();
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

  const resetLink = async (s) => {
    const ok = await confirm({
      title: `Email ${s.name} a reset link?`,
      body: `A link to choose a new password goes to ${s.email}. It works once, for 1 hour. Their current password keeps working until they use it.`,
      confirmLabel: "Send link",
    });
    if (!ok) return;
    sendLink.mutate(s.id, {
      onSuccess: () => toast.success("Reset link sent", { description: s.email }),
      onError: (e) => toast.error("Couldn't send the link", { description: e.message }),
    });
  };

  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg">
        <CardHeader
          title="Staff accounts"
          description="Who can sign in to the desk app."
          action={
            <Button size="sm" variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Add staff
            </Button>
          }
        />
        {staff.isPending ? (
          <SkeletonList rows={3} />
        ) : staff.isError ? (
          <ErrorState compact error={staff.error} onRetry={() => staff.refetch()} />
        ) : (
          <ul className="-mx-2 flex flex-col divide-y divide-line">
            {staff.data.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 py-3">
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-semibold">
                    {s.name} {s.id === me?.id && <span className="font-normal text-ink-3">(you)</span>}
                  </p>
                  <p className="truncate text-[13px] text-ink-3">
                    {s.email} · {s.lastLoginAt ? `last signed in ${formatRelativeTime(s.lastLoginAt)}` : "never signed in"}
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <Badge size="sm" tone={s.role === "admin" ? "brand" : "neutral"}>
                      {ROLE_LABEL[s.role]}
                    </Badge>
                    {!s.isActive && (
                      <Badge size="sm" tone="bad" icon={UserRoundX}>
                        Deactivated
                      </Badge>
                    )}
                    {s.lockedForMinutes > 0 && (
                      <Badge size="sm" tone="warn" icon={Lock}>
                        Sign-in paused {s.lockedForMinutes} min
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditing(s)}>
                    Edit
                  </Button>
                  {s.isActive && s.id !== me?.id && (
                    <Button size="sm" variant="ghost" icon={Mail} onClick={() => resetLink(s)} loading={sendLink.isPending && sendLink.variables === s.id}>
                      Reset link
                    </Button>
                  )}
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
      <RoleMatrix />
    </div>
  );
}
