import { useCallback, useEffect, useRef, useState } from "react";
import { useBlocker, useLocation, useNavigate } from "react-router-dom";
import {
  Camera,
  CircleAlert,
  CircleCheck,
  Expand,
  Info,
  Lock,
  LogOut,
  MonitorSmartphone,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  WifiOff,
} from "lucide-react";
import { useKioskGym, useScan } from "./api";
import { useQrScanner } from "./useQrScanner";
import { formatDuration, shortName } from "./lib";
import { useLogout } from "../auth/api";
import { usePermission } from "../auth/permissions";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import { storage } from "../../shared/lib/storage";
import { cn } from "../../shared/lib/cn";
import { BUTTON_VARIANTS } from "../../shared/ui/styles";
import { formatTime } from "../../shared/lib/format";
import { Avatar, Button, ButtonLink, Card, Dialog, Field, InlineAlert, Input, SegmentedControl, Switch } from "../../shared/ui";

/**
 * Entrance kiosk: a tablet at the door, signed in by staff, that members scan their QR code at.
 *
 * Setup (staff): choose an exit PIN and the camera, then start. From then on the screen shows only
 * the scanner, big result screens, a "Leaving?" check-out button and a small "Staff exit" that
 * needs the PIN. The lock survives a reload (kept on this device), browser back is blocked, and
 * the kiosk never lets anyone in without an active plan: those members are sent to the desk.
 */

const LOCK_KEY = "kv.kiosk";
/** How long each result stays up before the kiosk is ready for the next person. */
const RESULT_MS = { good: 4000, info: 5000, bad: 7000 };
/** The same code again within this window is the same person still holding their phone up. */
const SAME_CODE_MS = 8000;
/** "Leaving?" check-out mode turns itself off after this long. */
const OUT_MODE_MS = 30_000;
/** Give up waiting for the server after this long and send the member to the desk. */
const SCAN_TIMEOUT_MS = 12_000;
const MAX_PIN_TRIES = 5;
const PIN_LOCKOUT_MS = 60_000;

// ── Device helpers ─────────────────────────────────────────────────────────

async function hashPin(pin, salt) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${pin}`));
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, "0")).join("");
}

const readLock = () => {
  const saved = storage.get(LOCK_KEY);
  return saved?.pinHash && saved?.salt ? saved : null;
};

function enterFullscreen() {
  document.documentElement.requestFullscreen?.().catch(() => {});
}

function leaveFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
}

let audio = null;
/** Must run from a tap (browsers only allow sound after one). */
function unlockAudio() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!audio && Ctx) audio = new Ctx();
    audio?.resume?.();
  } catch {
    audio = null;
  }
}

/** Short tones: rising for welcome, single for information, falling for "see the desk". */
function beep(tone) {
  if (!audio || audio.state !== "running") return;
  const notes = tone === "bad" ? [[392, 0], [262, 0.2]] : tone === "info" ? [[660, 0]] : [[880, 0], [1175, 0.12]];
  const t = audio.currentTime;
  for (const [freq, at] of notes) {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + at);
    gain.gain.exponentialRampToValueAtTime(0.2, t + at + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + at + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start(t + at);
    osc.stop(t + at + 0.2);
  }
}

function useNow(everyMs) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return now;
}

function useIsFullscreen() {
  const [full, setFull] = useState(() => Boolean(document.fullscreenElement));
  useEffect(() => {
    const onChange = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  return full;
}

/** Keep the tablet's screen on while the kiosk runs. */
function useWakeLock() {
  useEffect(() => {
    let lock = null;
    let stopped = false;
    const acquire = async () => {
      if (stopped || document.visibilityState !== "visible" || !navigator.wakeLock) return;
      try {
        lock = await navigator.wakeLock.request("screen");
      } catch {
        /* not supported or refused (battery saver): the kiosk still works */
      }
    };
    acquire();
    const onVisible = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release?.().catch(() => {});
    };
  }, []);
}

// ── What the member sees ───────────────────────────────────────────────────

/** Turn a scan result into the kiosk's result screen. Names are shortened: this is a shared screen. */
function kioskView(result) {
  if (result.ok) {
    const { action, member, membership, attendance } = result.data;
    const first = shortName(member.name);
    const base = { member, first };
    if (action === "checked_in" || action === "returned") {
      const endsSoon = membership?.state === "active" && membership.daysLeft != null && membership.daysLeft <= 3;
      return {
        ...base,
        tone: "good",
        icon: CircleCheck,
        title: action === "returned" ? `Welcome back, ${first}` : `Welcome, ${first}`,
        line: `Checked in at ${formatTime(attendance.lastInAt || attendance.checkedInAt)}`,
        note: endsSoon
          ? membership.daysLeft <= 0
            ? "Your plan ends today. Renew at the front desk."
            : `Your plan ends in ${membership.daysLeft} ${membership.daysLeft === 1 ? "day" : "days"}. Renew at the front desk.`
          : membership?.planName
            ? `${membership.planName} is active`
            : null,
        noteTone: endsSoon ? "warn" : null,
      };
    }
    if (action === "checked_out") {
      return {
        ...base,
        tone: "good",
        icon: LogOut,
        title: `See you soon, ${first}`,
        line: `Checked out at ${formatTime(attendance.checkedOutAt)}`,
        note: attendance.minutesInGym ? `${formatDuration(attendance.minutesInGym)} in the gym today` : null,
      };
    }
    if (action === "already_in") {
      return {
        ...base,
        tone: "info",
        icon: Info,
        title: "You're already checked in",
        line: `Since ${formatTime(attendance.lastInAt || attendance.checkedInAt)}`,
        note: "Leaving? Tap “Leaving? Check out” first, then scan.",
      };
    }
    return { ...base, tone: "info", icon: Info, title: "You've already checked out", line: `Left at ${formatTime(attendance.checkedOutAt)}` };
  }

  const { error } = result;
  const member = error.details?.member;
  if (error.code === "MEMBERSHIP_INACTIVE") {
    return {
      member,
      tone: "bad",
      icon: CircleAlert,
      title: "Please see the front desk",
      line: member ? `${shortName(member.name)}: ${error.details.reason}` : error.details?.reason,
      note: "The desk can renew your plan or help you in.",
    };
  }
  if (error.code === "NOT_CHECKED_IN") {
    return { member, tone: "info", icon: Info, title: "You haven't checked in today", line: "Scan again to check in." };
  }
  if (error.code === "QR_REVOKED") {
    return { tone: "bad", icon: CircleAlert, title: "This QR code was replaced", line: "Open the Kovij app for your latest code, or ask at the front desk." };
  }
  if (error.code === "QR_UNKNOWN") {
    return { tone: "bad", icon: CircleAlert, title: "Code not recognised", line: "Use the QR code in the Kovij app or on your member card." };
  }
  if (error.isNetwork || error.code === "TIMEOUT") {
    return { tone: "bad", icon: WifiOff, title: "Couldn't check you in", line: "The kiosk has no connection right now. Please check in at the front desk." };
  }
  return { tone: "bad", icon: CircleAlert, title: "Couldn't check you in", line: "Please check in at the front desk." };
}

const RESULT_TONE = {
  good: { layer: "bg-good-soft", icon: "text-good" },
  info: { layer: "bg-info-soft", icon: "text-info" },
  bad: { layer: "bg-bad-soft", icon: "text-bad" },
};

/** Large touch target for members at the door (the shared Button tops out at 48px). */
function KioskButton({ icon: Icon, variant = "inverse", className, children, ...props }) {
  return (
    <button
      type="button"
      className={cn("inline-flex h-14 items-center justify-center gap-2 rounded-control px-7 text-lg transition-colors duration-150", BUTTON_VARIANTS[variant], className)}
      {...props}
    >
      {Icon && <Icon className="size-5" aria-hidden />}
      {children}
    </button>
  );
}

/** Full-screen outcome. Tapping anywhere (or the button) moves on; it also moves on by itself. */
function ResultScreen({ view, onDismiss }) {
  const tone = RESULT_TONE[view.tone];
  const Icon = view.icon;
  return (
    <div className="fixed inset-0 z-20 bg-canvas text-ink" onClick={onDismiss}>
      <div role="status" aria-live="assertive" className={cn("flex size-full flex-col items-center justify-center gap-5 px-6 text-center", tone.layer)}>
        <Icon className={cn("size-24 sm:size-32", tone.icon)} strokeWidth={2.2} aria-hidden />
        {view.member && <Avatar name={view.member.name} src={view.member.profilePhoto} size="xl" />}
        <p className="text-[clamp(2rem,6vw,4rem)] font-extrabold leading-tight tracking-tight">{view.title}</p>
        {view.line && <p className="text-[clamp(1.25rem,3vw,2rem)] font-semibold text-ink-2">{view.line}</p>}
        {view.note && (
          <p className={cn("max-w-2xl rounded-tile px-4 py-2 text-[clamp(1rem,2.2vw,1.5rem)]", view.noteTone === "warn" ? "bg-warn-soft font-semibold text-warn" : "text-ink-2")}>
            {view.note}
          </p>
        )}
        <KioskButton variant="secondary" className="mt-4 min-w-40" onClick={onDismiss}>
          Continue
        </KioskButton>
      </div>
    </div>
  );
}

// ── Staff exit ─────────────────────────────────────────────────────────────

function ExitDialog({ open, config, onCancel, onUnlocked, onSignOut }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState(null);
  const [tries, setTries] = useState(0);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [forgot, setForgot] = useState(false);

  useEffect(() => {
    if (!open) {
      setPin("");
      setError(null);
      setForgot(false);
    }
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (Date.now() < lockedUntil) {
      setError("Too many wrong PINs. Wait a minute, then try again.");
      return;
    }
    if (!pin) {
      setError("Enter the exit PIN");
      return;
    }
    if ((await hashPin(pin, config.salt)) === config.pinHash) {
      setTries(0);
      onUnlocked();
      return;
    }
    const used = tries + 1;
    setPin("");
    if (used >= MAX_PIN_TRIES) {
      setTries(0);
      setLockedUntil(Date.now() + PIN_LOCKOUT_MS);
      setError("Too many wrong PINs. Wait a minute, then try again.");
    } else {
      setTries(used);
      setError(`That PIN doesn't match. ${MAX_PIN_TRIES - used} ${MAX_PIN_TRIES - used === 1 ? "try" : "tries"} left.`);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title="Staff exit"
      description="Enter the exit PIN set when the kiosk was started."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Back to kiosk
          </Button>
          <Button variant="primary" type="submit" form="kiosk-exit" icon={ShieldCheck}>
            Exit kiosk
          </Button>
        </>
      }
    >
      <form id="kiosk-exit" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Field label="Exit PIN" error={error}>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            autoFocus
            className="tabular text-center tracking-[0.4em]"
          />
        </Field>
        {forgot ? (
          <InlineAlert
            tone="warning"
            title="Sign out of this device?"
            action={
              <Button variant="danger" size="sm" onClick={onSignOut}>
                Sign out
              </Button>
            }
          >
            The kiosk stops and a staff member will need their password to sign in again.
          </InlineAlert>
        ) : (
          <button type="button" onClick={() => setForgot(true)} className="self-start text-sm font-semibold text-brand-ink hover:underline">
            Forgot the PIN?
          </button>
        )}
      </form>
    </Dialog>
  );
}

// ── Setup (staff) ──────────────────────────────────────────────────────────

function KioskSetup({ onStart }) {
  const canRun = usePermission("attendance.checkin");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [camera, setCamera] = useState("user");
  const [sound, setSound] = useState(true);
  const [errors, setErrors] = useState({});
  const secure = window.isSecureContext !== false && Boolean(globalThis.crypto?.subtle);

  const start = async (e) => {
    e.preventDefault();
    const next = {};
    if (!/^\d{4,6}$/.test(pin)) next.pin = "Use 4 to 6 digits";
    else if (pin !== pin2) next.pin2 = "The two PINs don't match";
    setErrors(next);
    if (Object.keys(next).length) return;
    // Both need the tap that started this, so they run before anything is awaited.
    enterFullscreen();
    if (sound) unlockAudio();
    const salt = newIdempotencyKey();
    onStart({ pinHash: await hashPin(pin, salt), salt, facingMode: camera, sound, startedAt: new Date().toISOString() });
  };

  return (
    <div className="kv-app grid min-h-dvh place-items-center bg-canvas px-4 py-8 font-ui text-ink">
      <Card padding="lg" className="w-full max-w-lg">
        <div className="mb-5 flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink">
            <MonitorSmartphone className="size-5" aria-hidden />
          </div>
          <div>
            <h1 className="text-xl font-bold">Set up the entrance kiosk</h1>
            <p className="mt-1 text-sm text-ink-3">
              Members scan their QR code to check in and out. The screen stays locked until someone enters the exit PIN.
            </p>
          </div>
        </div>

        {!canRun ? (
          <InlineAlert tone="warning" title="Not available for your role" action={<ButtonLink to="/admin" variant="secondary" size="sm">Back to the app</ButtonLink>}>
            Ask a front desk staff member or the owner to start the kiosk.
          </InlineAlert>
        ) : !secure ? (
          <InlineAlert tone="danger" title="The kiosk needs a secure connection">
            Open the app over https so the camera can be used.
          </InlineAlert>
        ) : (
          <form onSubmit={start} noValidate className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Exit PIN" hint="4 to 6 digits" error={errors.pin} required>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Repeat the PIN" error={errors.pin2} required>
                <Input type="password" inputMode="numeric" autoComplete="new-password" maxLength={6} value={pin2} onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
            <div className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold text-ink" aria-hidden>
                Camera
              </p>
              <SegmentedControl
                label="Camera"
                block
                value={camera}
                onChange={setCamera}
                options={[
                  { value: "user", label: "Front (facing members)" },
                  { value: "environment", label: "Back" },
                ]}
              />
            </div>
            <Switch checked={sound} onChange={setSound} label="Beep on each scan" description="A rising tone for welcome, a low tone for “see the desk”." />
            <InlineAlert tone="info">
              On a shared tablet, also turn on screen pinning (Android) or Guided Access (iPad) so the browser can't be closed.
            </InlineAlert>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <ButtonLink to="/admin/check-in" variant="secondary">
                Back to check-in
              </ButtonLink>
              <Button type="submit" variant="primary" icon={ScanLine}>
                Start kiosk
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}

// ── Running kiosk ──────────────────────────────────────────────────────────

function CameraMessage({ status, onRetry }) {
  if (status === "scanning" || status === "idle") return null;
  const copy = {
    starting: { title: "Starting the camera…" },
    denied: { title: "Camera is blocked", body: "Staff: allow the camera for this site in the browser settings, then tap Try again." },
    unavailable: { title: "No camera found", body: "Staff: connect a camera, or check members in at the desk." },
    error: { title: "The camera stopped", body: "Staff: tap Try again." },
  }[status];
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center" role="status">
      <Camera className="size-10 text-hero-ink-2" aria-hidden />
      <p className="text-xl font-bold text-hero-ink">{copy.title}</p>
      {copy.body && <p className="max-w-sm text-base text-hero-ink-2">{copy.body}</p>}
      {(status === "denied" || status === "error") && (
        <Button variant="inverse" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

function KioskRunner({ config, onExit }) {
  const navigate = useNavigate();
  const logout = useLogout();
  const online = useOnlineStatus();
  const isFullscreen = useIsFullscreen();
  const now = useNow(15_000);
  const gym = useKioskGym();
  const { mutateAsync: scanAsync } = useScan();
  const [mode, setMode] = useState("auto");
  const [result, setResult] = useState(null);
  const [checking, setChecking] = useState(false);
  const [exitOpen, setExitOpen] = useState(false);
  const allowLeave = useRef(false);
  const busy = useRef(false);
  const last = useRef({ code: null, at: 0 });
  const modeRef = useRef(mode);
  const exitOpenRef = useRef(exitOpen);
  const processRef = useRef(null);
  useWakeLock();

  // After a reload the kiosk starts without a tap, so sound waits for the first touch.
  useEffect(() => {
    if (!config.sound) return undefined;
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, [config.sound]);

  useEffect(() => {
    modeRef.current = mode;
    exitOpenRef.current = exitOpen;
  }, [mode, exitOpen]);

  // Browser back, or any link, needs the PIN. Session expiry may still go to the sign-in page.
  const blocker = useBlocker(
    useCallback(({ nextLocation, historyAction }) => {
      if (allowLeave.current || nextLocation.pathname.startsWith("/admin/login")) return false;
      // Only the kiosk's own guard entry (below) may be pushed without the PIN.
      return !(historyAction === "PUSH" && nextLocation.state?.kioskGuard);
    }, [])
  );
  useEffect(() => {
    if (blocker.state === "blocked") setExitOpen(true);
  }, [blocker.state]);

  // A kiosk opened in a fresh tab has nothing behind it, so "back" would leave the app where no
  // PIN can be asked. One extra history entry keeps "back" inside the app, where it is blocked.
  const location = useLocation();
  const guarded = Boolean(location.state?.kioskGuard);
  const guardPushed = useRef(false);
  useEffect(() => {
    if (guarded || guardPushed.current) return;
    guardPushed.current = true;
    navigate(location.pathname, { state: { kioskGuard: true } });
  }, [guarded, navigate, location.pathname]);

  const process = useCallback(
    async (code) => {
      if (busy.current || exitOpenRef.current) return;
      if (last.current.code === code && Date.now() - last.current.at < SAME_CODE_MS) return;
      busy.current = true;
      last.current = { code, at: Date.now() };
      setChecking(true);
      let view;
      try {
        if (!navigator.onLine) throw Object.assign(new Error("offline"), { isNetwork: true });
        const data = await Promise.race([
          scanAsync({ code, mode: modeRef.current, source: "kiosk", idempotencyKey: newIdempotencyKey() }),
          new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error("timeout"), { code: "TIMEOUT" })), SCAN_TIMEOUT_MS)),
        ]);
        view = kioskView({ ok: true, data });
      } catch (error) {
        view = kioskView({ ok: false, error });
      }
      last.current = { code, at: Date.now() };
      busy.current = false;
      setChecking(false);
      setMode("auto");
      setResult(view);
      if (config.sound) beep(view.tone);
    },
    [scanAsync, config.sound]
  );
  useEffect(() => {
    processRef.current = process;
  }, [process]);

  const scanner = useQrScanner({ enabled: true, facingMode: config.facingMode, onDetect: process });
  const { pause, resume } = scanner;

  const dismiss = useCallback(() => {
    setResult(null);
    resume();
  }, [resume]);

  useEffect(() => {
    if (!result) return undefined;
    pause();
    const id = setTimeout(dismiss, RESULT_MS[result.tone] || RESULT_MS.info);
    return () => clearTimeout(id);
  }, [result, pause, dismiss]);

  useEffect(() => {
    if (mode !== "out") return undefined;
    const id = setTimeout(() => setMode("auto"), OUT_MODE_MS);
    return () => clearTimeout(id);
  }, [mode]);

  // USB / Bluetooth barcode scanners type the code and press Enter. Only full QR codes are
  // accepted, so nobody can check in by typing a member code at the door.
  useEffect(() => {
    let buffer = "";
    let lastKey = 0;
    const onKey = (e) => {
      if (exitOpenRef.current) return;
      if (e.key === "Enter") {
        const code = buffer.trim();
        buffer = "";
        if (code.startsWith("KV1.")) processRef.current?.(code);
        return;
      }
      if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return;
      const t = Date.now();
      if (t - lastKey > 1000) buffer = "";
      lastKey = t;
      buffer += e.key;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const unlock = () => {
    allowLeave.current = true;
    storage.remove(LOCK_KEY);
    leaveFullscreen();
    setExitOpen(false);
    // Always land on the check-in page, whether staff tapped "Staff exit" or pressed back.
    if (blocker.state === "blocked") blocker.reset();
    onExit();
    navigate("/admin/check-in");
  };

  const cancelExit = () => {
    setExitOpen(false);
    if (blocker.state === "blocked") blocker.reset();
  };

  const signOut = () => {
    allowLeave.current = true;
    storage.remove(LOCK_KEY);
    leaveFullscreen();
    logout();
  };

  const gymName = gym.data?.gymName || "Welcome";
  const out = mode === "out";
  const clock = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" }).format(now);

  return (
    <div className="kv-app fixed inset-0 flex flex-col overflow-hidden bg-hero font-ui text-hero-ink">
      {!online && (
        <div role="alert" className="flex items-center justify-center gap-2 bg-warn-soft px-4 py-2 text-center text-sm font-semibold text-warn">
          <WifiOff className="size-4" aria-hidden />
          No connection. Please check in at the front desk until it's back.
        </div>
      )}

      <header className="flex items-center justify-between gap-4 px-5 pb-2 pt-[max(1rem,env(safe-area-inset-top))] sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          {gym.data?.logoUrl && <img src={gym.data.logoUrl} alt="" className="size-10 rounded-tile object-cover" />}
          <p className="truncate text-xl font-bold sm:text-2xl">{gymName}</p>
        </div>
        <p className="tabular shrink-0 text-xl font-semibold text-hero-ink-2 sm:text-2xl">{clock}</p>
      </header>

      <main className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6 px-5 pb-4 sm:px-8 landscape:flex-row landscape:gap-10">
        <div
          className={cn(
            "relative aspect-square w-full max-w-[min(100%,56dvh)] shrink-0 overflow-hidden rounded-hero border-4 bg-canvas/10 landscape:max-w-[min(48vw,70dvh)]",
            out ? "border-brand" : "border-hero-line"
          )}
        >
          <video
            ref={scanner.videoRef}
            playsInline
            muted
            autoPlay
            aria-label="Camera"
            className={cn("size-full object-cover", config.facingMode === "user" && "-scale-x-100", scanner.status !== "scanning" && "opacity-0")}
          />
          {scanner.status === "scanning" && (
            <div aria-hidden className="pointer-events-none absolute inset-[16%] rounded-[24px] border-4 border-dashed border-hero-ink/80" />
          )}
          {checking && (
            <div className="absolute inset-x-0 bottom-0 bg-hero/85 py-3 text-center text-lg font-semibold" role="status">
              Checking…
            </div>
          )}
          <CameraMessage status={scanner.status} onRetry={scanner.retry} />
        </div>

        <div className="flex max-w-xl flex-col items-center gap-4 text-center landscape:items-start landscape:text-left">
          <h1 className="text-[clamp(1.75rem,5vw,3.25rem)] font-extrabold leading-tight tracking-tight">
            {out ? "Scan to check out" : "Show your QR code"}
          </h1>
          <p className="text-[clamp(1.05rem,2.4vw,1.5rem)] text-hero-ink-2">
            {out ? "Hold your code up to the camera to check out." : "Open the Kovij app, or hold up your member card, facing the camera."}
          </p>
          {out ? (
            <KioskButton onClick={() => setMode("auto")}>Cancel check-out</KioskButton>
          ) : (
            <KioskButton icon={LogOut} onClick={() => setMode("out")}>
              Leaving? Check out
            </KioskButton>
          )}
        </div>
      </main>

      <footer className="flex items-center justify-between gap-3 px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-8">
        <p className="text-sm text-hero-ink-2">Having trouble? Ask at the front desk.</p>
        <div className="flex items-center gap-1">
          {!isFullscreen && document.documentElement.requestFullscreen && (
            <button type="button" onClick={enterFullscreen} className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-hero-ink-2 hover:bg-hero-line hover:text-hero-ink">
              <Expand className="size-4" aria-hidden />
              Full screen
            </button>
          )}
          <button type="button" onClick={() => setExitOpen(true)} className="inline-flex h-11 items-center gap-1.5 rounded-control px-3 text-sm font-semibold text-hero-ink-2 hover:bg-hero-line hover:text-hero-ink">
            <Lock className="size-4" aria-hidden />
            Staff exit
          </button>
        </div>
      </footer>

      {result && <ResultScreen view={result} onDismiss={dismiss} />}
      <ExitDialog open={exitOpen} config={config} onCancel={cancelExit} onUnlocked={unlock} onSignOut={signOut} />
    </div>
  );
}

export default function KioskPage() {
  const [config, setConfig] = useState(readLock);
  if (!config) {
    return (
      <KioskSetup
        onStart={(next) => {
          storage.set(LOCK_KEY, next);
          setConfig(next);
        }}
      />
    );
  }
  return <KioskRunner config={config} onExit={() => setConfig(null)} />;
}
