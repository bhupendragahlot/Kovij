import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Send } from "lucide-react";
import { useForgotPassword } from "./api";
import { AuthNotice, AuthShell } from "./AuthShell";
import { Button, Field, Input } from "../../shared/ui";

/** OWNER: security module. Staff ask for a password reset link by email. */
export default function ForgotPasswordPage() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get("email") || "");
  const forgot = useForgotPassword();
  const fieldError = forgot.error?.fields?.email;
  const sentTo = forgot.isSuccess ? forgot.variables : null;

  const submit = (e) => {
    e.preventDefault();
    forgot.mutate(email.trim());
  };

  return (
    <AuthShell title="Reset your password" description="Enter the email you sign in with. We’ll email you a link to choose a new password.">
      {sentTo ? (
        <>
          <AuthNotice tone="good">
            If <strong className="font-semibold">{sentTo}</strong> belongs to a staff account, a reset link is on its way. It works once, for 1 hour.
          </AuthNotice>
          <p className="mt-4 text-sm text-ink-3">No email after a few minutes? Check spam, or ask the gym owner to send you a link from Settings, Staff.</p>
          <Button variant="secondary" block className="mt-6" onClick={() => forgot.reset()}>
            Send another link
          </Button>
        </>
      ) : (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
          {forgot.error && !fieldError && <AuthNotice className="mt-0">{forgot.error.message}</AuthNotice>}
          <Field label="Email" error={fieldError}>
            <Input type="email" autoComplete="username" inputMode="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Button type="submit" variant="primary" size="lg" block loading={forgot.isPending} icon={Send} disabled={!email.trim()}>
            Email me a link
          </Button>
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
