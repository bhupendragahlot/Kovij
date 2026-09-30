import { useEffect, useRef, useState } from "react";
import { Navigate, useSearchParams } from "react-router-dom";
import { useSelector } from "react-redux";
import { Eye, EyeOff, LogIn, TriangleAlert } from "lucide-react";
import { useLogin } from "./api";
import { selectToken } from "./sessionSlice";
import { Button, Field, Input } from "../../shared/ui";
import { BrandMark } from "../../layouts/crm/BrandMark";

/** Only allow redirects back into the staff app (never to another site). */
function safeNext(value) {
  return value && value.startsWith("/admin") && !value.startsWith("//") ? value : "/admin";
}

export default function StaffLoginPage() {
  const [params] = useSearchParams();
  const token = useSelector(selectToken);
  const login = useLogin();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  if (token) return <Navigate to={safeNext(params.get("next"))} replace />;

  const fieldErrors = login.error?.fields || {};
  const formError = login.error && !Object.keys(fieldErrors).length ? login.error.message : null;
  const expired = params.get("reason") === "expired" && !login.isPending && !login.error;

  const submit = (e) => {
    e.preventDefault();
    login.mutate(form);
  };

  return (
    <div className="kv-app flex min-h-dvh bg-canvas font-ui text-ink">
      <aside className="relative hidden w-[44%] max-w-xl flex-col justify-between overflow-hidden bg-rail p-10 text-rail-ink lg:flex">
        <BrandMark />
        <div>
          <p className="text-[44px] font-bold leading-[1.05] tracking-[-0.03em]">
            Run the front desk
            <br />
            from one screen.
          </p>
          <p className="mt-4 max-w-sm text-[15px] text-rail-ink-2">
            Check members in, collect dues, renew plans and follow up leads at Kovij Fitness Zone.
          </p>
        </div>
        <p className="text-sm text-rail-ink-2">Staff access only</p>
      </aside>

      <main className="flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <BrandMark tone="ink" />
          </div>
          <h1 className="text-title font-bold">Sign in</h1>
          <p className="mt-1 text-[15px] text-ink-3">Use the staff account the gym owner set up for you.</p>

          {(expired || formError) && (
            <div role="alert" className="mt-6 flex gap-2.5 rounded-tile bg-warn-soft p-3.5 text-sm text-warn">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <p>{expired ? "Your session ended. Sign in again to continue where you left off." : formError}</p>
            </div>
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
          <p className="mt-6 text-[13px] text-ink-3">Forgot your password? Ask the gym owner to reset it in Settings, Staff.</p>
        </div>
      </main>
    </div>
  );
}
