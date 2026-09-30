import { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Eye, EyeOff, Loader2, Mail, MailCheck, Smartphone, UserRound } from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { authErrorMessage } from "./authErrors";
import * as fb from "./firebaseAuth";

const RESEND_SECONDS = 30;
const MIN_PASSWORD = 8;

/**
 * Member sign-in and sign-up: mobile number + SMS code, email + password, or Google.
 * The page that renders it redirects once `member` is set in MemberAuthContext.
 *
 * Views: phone → otp · email → signup · forgot · verify (email link) · name (new account) · choose (shared phone)
 */
export default function MemberAuthPanel({ title, subtitle }) {
  const { exchangeSession } = useMemberAuth();
  const [view, setView] = useState("phone");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const [sentTo, setSentTo] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const [candidates, setCandidates] = useState([]);
  const confirmation = useRef(null);
  const pendingUser = useRef(null);
  const chosenMember = useRef(undefined);
  const recaptchaHost = useRef(null);

  useEffect(() => {
    if (cooldown <= 0) return undefined;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const go = (next) => {
    setError("");
    setNotice("");
    setView(next);
  };

  async function run(key, task) {
    setBusy(key);
    setError("");
    setNotice("");
    try {
      await task();
    } catch (err) {
      const message = authErrorMessage(err);
      if (message) setError(message);
    } finally {
      setBusy(null);
    }
  }

  /** Swap the Firebase sign-in for a gym session, answering any follow-up the server asks. */
  async function finish(user, extra = {}) {
    pendingUser.current = user;
    try {
      await exchangeSession(user, extra);
    } catch (err) {
      const data = err?.response?.data;
      if (data?.code === "NEEDS_NAME") {
        setName(user.displayName || "");
        return setView("name");
      }
      if (data?.code === "CHOOSE_MEMBER") {
        setCandidates(data.details?.candidates || []);
        return setView("choose");
      }
      if (data?.code === "EMAIL_NOT_VERIFIED") return setView("verify");
      pendingUser.current = null;
      await fb.signOutFirebase();
      throw err;
    }
  }

  async function startOver() {
    pendingUser.current = null;
    chosenMember.current = undefined;
    confirmation.current = null;
    await fb.signOutFirebase();
    go("phone");
  }

  const google = () => run("google", async () => finish(await fb.signInWithGoogle()));

  const sendCode = (e) => {
    e?.preventDefault();
    const e164 = fb.toE164(phone);
    if (!e164) return setError("Enter a 10-digit mobile number, or start with + and your country code.");
    return run("send", async () => {
      confirmation.current = await fb.sendPhoneCode(e164, recaptchaHost.current);
      setSentTo(e164);
      setCode("");
      setCooldown(RESEND_SECONDS);
      setView("otp");
    });
  };

  const verifyCode = (value = code) => {
    if (value.length !== 6) return setError("Enter the 6-digit code from the SMS.");
    if (!confirmation.current) return go("phone");
    return run("verify", async () => finish(await confirmation.current.confirm(value)));
  };

  const emailSignIn = (e) => {
    e.preventDefault();
    run("email", async () => {
      const user = await fb.signInWithEmail(email, password);
      if (!user.emailVerified) {
        pendingUser.current = user;
        return setView("verify");
      }
      return finish(user);
    });
  };

  const emailSignUp = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (password.length < MIN_PASSWORD) return setError(`Use a password with at least ${MIN_PASSWORD} characters.`);
    return run("signup", async () => {
      pendingUser.current = await fb.signUpWithEmail({ name, email, password });
      setCooldown(60);
      setView("verify");
    });
  };

  const checkVerified = () =>
    run("check", async () => {
      const user = await fb.reloadCurrentUser();
      if (!user) return go("email");
      if (!user.emailVerified) {
        return setError("We can’t see the click yet. Open the link in the email, then tap the button again.");
      }
      await user.getIdToken(true); // refresh so the server sees the verified email
      return finish(user, user.displayName ? { name: user.displayName } : {});
    });

  const resendVerification = () =>
    run("resend", async () => {
      await fb.resendVerificationEmail();
      setCooldown(60);
      setNotice("Sent again. Check your inbox and spam folder.");
    });

  const sendReset = (e) => {
    e.preventDefault();
    run("reset", async () => {
      try {
        await fb.sendPasswordReset(email);
      } catch (err) {
        // Don't reveal whether an email has an account.
        if (err?.code !== "auth/user-not-found") throw err;
      }
      setNotice(`If ${email.trim()} has an account, we’ve sent a link to set a new password.`);
    });
  };

  const submitName = (e) => {
    e.preventDefault();
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!pendingUser.current) return startOver();
    return run("name", async () => finish(pendingUser.current, { name: name.trim(), memberId: chosenMember.current }));
  };

  const choose = (memberId) => {
    chosenMember.current = memberId;
    return run(`choose-${memberId}`, async () => finish(pendingUser.current, { memberId }));
  };

  const tab = view === "phone" || view === "otp" ? "phone" : "email";
  const showTabs = ["phone", "email", "signup"].includes(view);

  return (
    <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/90 p-6 shadow-xl sm:p-8">
      <h1 className="text-center font-['Lexend'] text-2xl font-black uppercase text-white">{title}</h1>
      {subtitle && <p className="mt-2 text-center text-sm text-neutral-400">{subtitle}</p>}

      {showTabs && (
        <div role="tablist" aria-label="Sign-in method" className="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-neutral-900 p-1">
          <TabButton active={tab === "phone"} onClick={() => go("phone")} icon={Smartphone}>
            Mobile
          </TabButton>
          <TabButton active={tab === "email"} onClick={() => go("email")} icon={Mail}>
            Email
          </TabButton>
        </div>
      )}

      <div className="mt-5 space-y-4">
        {error && (
          <p role="alert" className="rounded-lg border border-red-900 bg-red-950/60 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {notice && (
          <p role="status" className="rounded-lg border border-emerald-900 bg-emerald-950/50 px-3 py-2 text-sm text-emerald-200">
            {notice}
          </p>
        )}

        {view === "phone" && (
          <form onSubmit={sendCode} className="space-y-4" noValidate>
            <Field label="Mobile number" hint="We’ll text you a 6-digit code.">
              {(id) => (
                <div className="flex h-11 items-center rounded-lg border border-neutral-700 bg-neutral-900 focus-within:border-red-500 focus-within:ring-2 focus-within:ring-red-500/30">
                  {!phone.trim().startsWith("+") && <span className="pl-3 pr-1 text-sm text-neutral-400">+91</span>}
                  <input
                    id={id}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="98765 43210"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-full w-full bg-transparent px-2 text-base text-white outline-none placeholder:text-neutral-600"
                  />
                </div>
              )}
            </Field>
            <PrimaryButton busy={busy === "send"}>Send code</PrimaryButton>
          </form>
        )}

        {view === "otp" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              verifyCode();
            }}
            className="space-y-4"
            noValidate
          >
            <BackLink onClick={() => go("phone")}>Change number</BackLink>
            <Field label="Enter the 6-digit code" hint={`Sent by SMS to ${sentTo}`}>
              {(id) => (
                <input
                  id={id}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  autoFocus
                  value={code}
                  onChange={(e) => {
                    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setCode(v);
                    if (v.length === 6 && !busy) verifyCode(v);
                  }}
                  className={`${inputClass} text-center font-mono text-2xl tracking-[0.5em]`}
                />
              )}
            </Field>
            <PrimaryButton busy={busy === "verify"}>Verify and continue</PrimaryButton>
            <p className="text-center text-sm text-neutral-400">
              {cooldown > 0 ? (
                <>Didn’t get it? You can resend in {cooldown}s</>
              ) : (
                <TextButton onClick={() => sendCode()} disabled={Boolean(busy)}>
                  Resend code
                </TextButton>
              )}
            </p>
          </form>
        )}

        {view === "email" && (
          <form onSubmit={emailSignIn} className="space-y-4" noValidate>
            <EmailField value={email} onChange={setEmail} />
            <PasswordField value={password} onChange={setPassword} autoComplete="current-password" extra={
              <TextButton onClick={() => go("forgot")}>Forgot password?</TextButton>
            } />
            <PrimaryButton busy={busy === "email"}>Sign in</PrimaryButton>
            <p className="text-center text-sm text-neutral-400">
              New here? <TextButton onClick={() => go("signup")}>Create an account</TextButton>
            </p>
          </form>
        )}

        {view === "signup" && (
          <form onSubmit={emailSignUp} className="space-y-4" noValidate>
            <Field label="Full name">
              {(id) => (
                <input id={id} autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              )}
            </Field>
            <EmailField value={email} onChange={setEmail} />
            <PasswordField value={password} onChange={setPassword} autoComplete="new-password" hint={`At least ${MIN_PASSWORD} characters.`} />
            <PrimaryButton busy={busy === "signup"}>Create account</PrimaryButton>
            <p className="text-center text-sm text-neutral-400">
              Already have an account? <TextButton onClick={() => go("email")}>Sign in</TextButton>
            </p>
          </form>
        )}

        {view === "forgot" && (
          <form onSubmit={sendReset} className="space-y-4" noValidate>
            <BackLink onClick={() => go("email")}>Back to sign in</BackLink>
            <p className="text-sm text-neutral-300">Enter the email you signed up with. We’ll send a link to set a new password.</p>
            <EmailField value={email} onChange={setEmail} />
            <PrimaryButton busy={busy === "reset"}>Send reset link</PrimaryButton>
          </form>
        )}

        {view === "verify" && (
          <div className="space-y-4 text-center">
            <MailCheck className="mx-auto h-10 w-10 text-red-500" aria-hidden />
            <p className="text-sm text-neutral-300">
              We sent a link to <span className="font-semibold text-white">{pendingUser.current?.email || email}</span>. Open it to confirm your
              email, then come back here.
            </p>
            <PrimaryButton type="button" onClick={checkVerified} busy={busy === "check"}>
              I’ve confirmed my email
            </PrimaryButton>
            <p className="text-sm text-neutral-400">
              {cooldown > 0 ? (
                <>You can resend the email in {cooldown}s</>
              ) : (
                <TextButton onClick={resendVerification} disabled={Boolean(busy)}>
                  Resend email
                </TextButton>
              )}
            </p>
            <TextButton onClick={startOver}>Use a different sign-in</TextButton>
          </div>
        )}

        {view === "name" && (
          <form onSubmit={submitName} className="space-y-4" noValidate>
            <p className="text-sm text-neutral-300">You’re new here. What’s your name?</p>
            <Field label="Full name">
              {(id) => (
                <input id={id} autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
              )}
            </Field>
            <PrimaryButton busy={busy === "name"}>Create my account</PrimaryButton>
            <div className="text-center">
              <TextButton onClick={startOver}>Cancel</TextButton>
            </div>
          </form>
        )}

        {view === "choose" && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-300">This number is shared by more than one member. Who are you?</p>
            {candidates.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={Boolean(busy)}
                onClick={() => choose(c.id)}
                className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-4 py-2 text-left text-white hover:border-red-500 disabled:opacity-60"
              >
                <UserRound className="h-5 w-5 shrink-0 text-neutral-400" aria-hidden />
                <span className="flex-1">
                  <span className="block font-semibold">{c.name}</span>
                  {c.memberCode && <span className="block text-xs text-neutral-400">Member ID {c.memberCode}</span>}
                </span>
                {busy === `choose-${c.id}` && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              </button>
            ))}
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => choose("new")}
              className="min-h-11 w-full rounded-lg border border-dashed border-neutral-700 px-4 py-2 text-sm text-neutral-300 hover:border-neutral-500 hover:text-white disabled:opacity-60"
            >
              {busy === "choose-new" ? "Creating…" : "None of these — create a new account"}
            </button>
            <div className="text-center">
              <TextButton onClick={startOver}>Cancel</TextButton>
            </div>
          </div>
        )}

        {showTabs && (
          <>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wider text-neutral-500" aria-hidden>
              <span className="h-px flex-1 bg-neutral-700" />
              or
              <span className="h-px flex-1 bg-neutral-700" />
            </div>
            <button
              type="button"
              onClick={google}
              disabled={Boolean(busy)}
              className="flex h-11 w-full items-center justify-center gap-3 rounded-lg bg-white px-4 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-60"
            >
              {busy === "google" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <GoogleMark />}
              Continue with Google
            </button>
          </>
        )}
      </div>

      {/* The invisible reCAPTCHA Firebase needs before it sends an SMS. */}
      <div ref={recaptchaHost} />

      <p className="mt-8 text-center text-xs text-neutral-500">
        <Link to="/" className="text-red-500 hover:underline">
          Back to home
        </Link>
      </p>
    </div>
  );
}

const inputClass =
  "h-11 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 text-base text-white outline-none placeholder:text-neutral-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/30";

function Field({ label, hint, extra, children }) {
  const id = useId();
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-neutral-200">
          {label}
        </label>
        {extra}
      </div>
      {children(id)}
      {hint && <p className="mt-1.5 text-xs text-neutral-500">{hint}</p>}
    </div>
  );
}

function EmailField({ value, onChange }) {
  return (
    <Field label="Email">
      {(id) => (
        <input
          id={id}
          type="email"
          inputMode="email"
          autoComplete="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </Field>
  );
}

function PasswordField({ value, onChange, autoComplete, hint, extra }) {
  const [shown, setShown] = useState(false);
  return (
    <Field label="Password" hint={hint} extra={extra}>
      {(id) => (
        <div className="relative">
          <input
            id={id}
            type={shown ? "text" : "password"}
            autoComplete={autoComplete}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={`${inputClass} pr-11`}
          />
          <button
            type="button"
            onClick={() => setShown((s) => !s)}
            aria-label={shown ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-neutral-400 hover:text-white"
          >
            {shown ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
          </button>
        </div>
      )}
    </Field>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`flex h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
        active ? "bg-neutral-800 text-white shadow" : "text-neutral-400 hover:text-white"
      }`}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

function PrimaryButton({ busy, children, type = "submit", onClick }) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={busy}
      className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-red-600 px-4 text-sm font-bold text-white hover:bg-red-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 disabled:opacity-70"
    >
      {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

function TextButton({ onClick, disabled, children }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="text-sm font-semibold text-red-500 hover:underline disabled:opacity-60">
      {children}
    </button>
  );
}

function BackLink({ onClick, children }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-1 text-sm text-neutral-400 hover:text-white">
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {children}
    </button>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
