import { useState } from "react";
import { CircleCheck, KeyRound, TriangleAlert } from "lucide-react";
import { useSelector } from "react-redux";
import { useChangePassword, useMySignIns } from "../auth/api";
import { NewPasswordFields } from "../auth/NewPasswordFields";
import { newPasswordProblem } from "../auth/passwordRules";
import { selectStaffUser } from "../auth/sessionSlice";
import { Badge, Button, Card, CardHeader, Field, FormError, Input, QueryState, SkeletonList, useToast } from "../../shared/ui";
import { formatDateTime, formatRelativeTime } from "../../shared/lib/format";
import { ROLE_LABEL } from "../../shared/domain/status";

const REASON = {
  ok: "Signed in",
  wrong_password: "Wrong password",
  inactive: "Account was deactivated",
  locked: "Paused after wrong passwords",
  password_reset: "New password set with a reset link",
};

/** OWNER: security module. Settings > My account (every staff role). */
export function MyAccountSection() {
  const me = useSelector(selectStaffUser);
  return (
    <div className="flex flex-col gap-5">
      <Card padding="lg">
        <CardHeader title="Your account" description="Ask the gym owner if your name, email or role needs to change." />
        <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-[13px] text-ink-3">Name</dt>
            <dd className="mt-0.5 font-semibold">{me?.name}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[13px] text-ink-3">Email</dt>
            <dd className="mt-0.5 truncate font-semibold">{me?.email}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-ink-3">Role</dt>
            <dd className="mt-0.5 font-semibold">{ROLE_LABEL[me?.role] || me?.role}</dd>
          </div>
        </dl>
      </Card>
      <ChangePasswordCard email={me?.email} />
      <SignInsCard />
    </div>
  );
}

function ChangePasswordCard({ email }) {
  const change = useChangePassword();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState({ password: "", confirm: "" });
  const [localError, setLocalError] = useState(null);
  const server = change.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const problem = !current ? { current: "Enter your current password" } : newPasswordProblem(next, { email });
    setLocalError(problem);
    if (problem) return;
    change.mutate(
      { currentPassword: current, newPassword: next.password },
      {
        onSuccess: () => {
          toast.success("Password changed", { description: "Other devices were signed out." });
          setCurrent("");
          setNext({ password: "", confirm: "" });
        },
      }
    );
  };

  return (
    <Card padding="lg">
      <CardHeader title="Change password" description="You stay signed in here; every other device is signed out." />
      <form onSubmit={submit} className="flex max-w-md flex-col gap-4" noValidate>
        {change.error && !Object.keys(server).length && <FormError error={change.error} />}
        <Field label="Current password" error={server.currentPassword || localError?.current}>
          <Input type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
        </Field>
        <NewPasswordFields value={next} onChange={setNext} errors={{ password: server.newPassword || localError?.password, confirm: localError?.confirm }} />
        <div>
          <Button type="submit" variant="primary" icon={KeyRound} loading={change.isPending}>
            Change password
          </Button>
        </div>
      </form>
    </Card>
  );
}

function SignInsCard() {
  const signIns = useMySignIns();
  return (
    <Card padding="lg">
      <CardHeader title="Recent sign-ins" description="If you see one you don’t recognise, change your password and tell the owner." />
      <QueryState query={signIns} skeleton={<SkeletonList rows={4} />} compact>
        {(items) =>
          items.length === 0 ? (
            <p className="text-sm text-ink-3">No sign-ins recorded yet.</p>
          ) : (
            <ul className="-mx-2 flex flex-col divide-y divide-line">
              {items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-2 py-2.5">
                  <Badge size="sm" tone={e.success ? "good" : "warn"} icon={e.success ? CircleCheck : TriangleAlert}>
                    {REASON[e.reason] || (e.success ? "Signed in" : "Failed")}
                  </Badge>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {e.device}
                    {e.ip && <span className="text-ink-3"> · {e.ip}</span>}
                  </span>
                  <time dateTime={e.at} title={formatDateTime(e.at)} className="tabular text-[13px] text-ink-3">
                    {formatRelativeTime(e.at)}
                  </time>
                </li>
              ))}
            </ul>
          )
        }
      </QueryState>
    </Card>
  );
}
