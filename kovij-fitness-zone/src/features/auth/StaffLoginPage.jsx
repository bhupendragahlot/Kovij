import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { useLogin } from "./api";
import { selectToken } from "./sessionSlice";
import { AuthNotice, AuthShell } from "./AuthShell";
import { Button, Field, Input } from "../../shared/ui";

/** Only allow redirects back into the staff app (never to another site). */
function safeNext(value) {
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export default function StaffLoginPage() {
  const [params] = useSearchParams();
  const token = useSelector(selectToken);
  const login = useLogin();
  const [form, setForm] = useState({ email: params.get("email") || "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);

  useEffect(() => {
    (form.email ? passwordRef : emailRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (token) return <Navigate to={safeNext(params.get("next"))} replace />;

  const fieldErrors = login.error?.fields || {};
  const formError = login.error && !Object.keys(fieldErrors).length ? login.error.message : null;
  const quiet = !login.isPending && !login.error;
  const reason = params.get("reason");

  const submit = (e) => {
    e.preventDefault();
    login.mutate(form);
  };

  return (
    <AuthShell title="Sign in" description="Use the staff account the gym owner set up for you.">
      {quiet && reason === "expired" && <AuthNotice>Your session ended. Sign in again to continue where you left off.</AuthNotice>}
      {quiet && reason === "reset" && <AuthNotice tone="good">Password changed. Sign in with your new password.</AuthNotice>}
      {formError && (
        <AuthNotice>
          {formError}
          {login.error?.code === "ACCOUNT_LOCKED" && (
            <>
              {" "}
              <Link to={`/admin/forgot-password?email=${encodeURIComponent(form.email)}`} className="font-semibold underline">
                Reset your password
              </Link>
            </>
          )}
        </AuthNotice>
      )}

      <form onSubmit={submit} className="mt-6 flex flex-col gap-4" noValidate>
        <Field label="Email" error={fieldErrors.email}>
          <Input
            ref={emailRef}
            type="email"
            autoComplete="username"
            inputMode="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </Field>
        <Field
          label="Password"
          error={fieldErrors.password}
          labelAction={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink"
              aria-pressed={showPassword}
            >
              {showPassword ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
              {showPassword ? "Hide" : "Show"}
            </button>
          }
        >
          <Input
            ref={passwordRef}
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" block loading={login.isPending} icon={LogIn} className="mt-2">
          Sign in
        </Button>
      </form>
      <p className="mt-6 text-sm">
        <Link
          to={`/admin/forgot-password${form.email ? `?email=${encodeURIComponent(form.email)}` : ""}`}
          className="font-semibold text-brand-ink hover:underline"
        >
          Forgot your password?
        </Link>
      </p>
    </AuthShell>
  );
}
