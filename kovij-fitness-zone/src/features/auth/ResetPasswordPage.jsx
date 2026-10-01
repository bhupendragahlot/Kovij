import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, KeyRound } from "lucide-react";
import { useResetLink, useResetPassword } from "./api";
import { AuthNotice, AuthShell } from "./AuthShell";
import { NewPasswordFields } from "./NewPasswordFields";
import { newPasswordProblem } from "./passwordRules";
import { Button, ButtonLink, SkeletonList } from "../../shared/ui";

/** OWNER: security module. Opened from the emailed link: /admin/reset-password?token=… */
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const link = useResetLink(token);
  const reset = useResetPassword();
  const [form, setForm] = useState({ password: "", confirm: "" });
  const [localError, setLocalError] = useState(null);

  const email = link.data?.email;
  const serverField = reset.error?.fields?.password;

  const submit = (e) => {
    e.preventDefault();
    const problem = newPasswordProblem(form, { email });
    setLocalError(problem);
    if (problem) return;
    reset.mutate(
      { token, password: form.password },
      { onSuccess: () => navigate(`/admin/login?reason=reset&email=${encodeURIComponent(email || "")}`, { replace: true }) }
    );
  };

  const expired = !token || link.data?.valid === false || reset.error?.code === "RESET_LINK_INVALID";

  return (
    <AuthShell title="Choose a new password" description={email ? `For ${email}` : undefined}>
      {link.isPending && token ? (
        <SkeletonList rows={2} className="mt-6" />
      ) : expired ? (
        <>
          <AuthNotice>This reset link has expired or was already used. Links work once, for 1 hour.</AuthNotice>
          <ButtonLink to="/admin/forgot-password" variant="primary" block className="mt-6">
            Get a new link
          </ButtonLink>
        </>
      ) : link.isError ? (
        <AuthNotice>{link.error.message}</AuthNotice>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          {reset.error && !serverField && !expired && <AuthNotice className="mt-0">{reset.error.message}</AuthNotice>}
          <NewPasswordFields value={form} onChange={setForm} errors={{ password: serverField || localError?.password, confirm: localError?.confirm }} />
          <Button type="submit" variant="primary" size="lg" block loading={reset.isPending} icon={KeyRound}>
            Save new password
          </Button>
          <p className="text-[13px] text-ink-3">You’ll be signed out on every other device.</p>
        </form>
      )}
      <p className="mt-6 text-sm">
        <Link to="/admin/login" className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
          <ArrowLeft className="size-4" aria-hidden />
          Back to sign in
        </Link>
      </p>
    </AuthShell>
  );
}
