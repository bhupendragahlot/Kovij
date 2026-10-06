import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Camera, CircleAlert, CircleCheck, DoorOpen, Info, LogIn, LogOut, RefreshCw, ScanLine, Undo2, Wallet } from "lucide-react";
import { useCheckIn, useScan, useUndoCheckIn } from "./api";
import { useQrScanner } from "./useQrScanner";
import { membershipLine } from "./useCheckInFlow";
import { formatDuration } from "./lib";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import { Avatar, Button, Dialog, Field, InlineAlert, Input, Skeleton, useToast } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatTime } from "../../shared/lib/format";

/** Successful scans go back to the camera on their own after this long. */
const AUTO_NEXT_MS = 4000;
/** The same code seen again within this window is the same person still holding it up. */
const SAME_CODE_MS = 5000;

const TONE = {
  good: { box: "bg-good-soft", icon: "text-good", Icon: CircleCheck },
  info: { box: "bg-info-soft", icon: "text-info", Icon: Info },
  bad: { box: "bg-bad-soft", icon: "text-bad", Icon: CircleAlert },
};

/** Turn a scan response or error into what the desk sees. */
function describe(result) {
  if (result.ok) {
    const { action, member, membership, attendance } = result.data;
    const name = member.name;
    if (action === "checked_in") return { tone: "good", title: `${name} checked in`, line: membershipLine(membership), member, canUndo: true };
    if (action === "returned") return { tone: "good", title: `${name} checked in again`, line: `Back at ${formatTime(attendance.lastInAt || attendance.checkedInAt)}`, member };
    if (action === "checked_out") {
      return { tone: "good", title: `${name} checked out`, line: `In the gym for ${formatDuration(attendance.minutesInGym)} today`, member };
    }
    if (action === "already_in") return { tone: "info", title: `${name} is already in`, line: `Since ${formatTime(attendance.lastInAt || attendance.checkedInAt)}`, member, offer: "out" };
    return { tone: "info", title: `${name} already checked out`, line: `Left at ${formatTime(attendance.checkedOutAt)}`, member, offer: "in" };
  }
  const { error } = result;
  const details = error.details || {};
  if (error.code === "MEMBERSHIP_INACTIVE") {
    return { tone: "bad", title: "Plan not active", line: error.message, member: details.member, blocked: details };
  }
  if (error.code === "QR_REVOKED") {
    return { tone: "bad", title: "Old QR code", line: "This code was replaced. Ask the member to open the latest code in the Kovij app, or print a new card from their profile.", member: details.member };
  }
  if (error.code === "NOT_CHECKED_IN") return { tone: "info", title: error.message, line: "Scan again to check them in.", member: details.member };
  if (error.isNetwork) return { tone: "bad", title: "Couldn't reach the server", line: error.message };
  return { tone: "bad", title: "Not a member code", line: error.message };
}

/**
 * Desk QR scanner in a sheet: camera preview, instant result, and a typed-code fallback that
 * also works with a USB or Bluetooth barcode scanner.
 */
export function ScanDialog({ open, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnlineStatus();
  const scanMutation = useScan();
  const checkIn = useCheckIn();
  const undo = useUndoCheckIn();
  const [result, setResult] = useState(null);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState(null);
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [reasonError, setReasonError] = useState(null);
  const last = useRef({ code: null, at: 0 });
  const typedRef = useRef(null);
  const busyRef = useRef(false);
  const lastCode = useRef(null);

  const submit = useCallback(
    async (code, mode = "auto") => {
      if (busyRef.current) return;
      busyRef.current = true;
      last.current = { code, at: Date.now() };
      lastCode.current = code;
      setTypedError(null);
      try {
        const data = await scanMutation.mutateAsync({ code, mode, source: "desk", idempotencyKey: newIdempotencyKey() });
        setResult({ ok: true, data });
        if (data.action === "checked_in") {
          toast.success(`${data.member.name} checked in`, {
            description: membershipLine(data.membership),
            action: { label: "Undo", onClick: () => undo.mutate(data.attendance._id, { onSuccess: () => toast.info(`Check-in for ${data.member.name} undone`) }) },
          });
        }
        setTyped("");
        return data;
      } catch (error) {
        if (error.code === "VALIDATION_ERROR" && error.fields?.code) setTypedError(error.fields.code);
        setResult({ ok: false, error });
        return null;
      } finally {
        busyRef.current = false;
      }
    },
    [scanMutation, toast, undo]
  );

  const onDetect = useCallback(
    (code) => {
      if (busyRef.current) return;
      if (last.current.code === code && Date.now() - last.current.at < SAME_CODE_MS) return;
      if (navigator.vibrate) navigator.vibrate(60);
      submit(code);
    },
    [submit]
  );

  const scanner = useQrScanner({ enabled: open, facingMode: "environment", onDetect });
  const { pause, resume } = scanner;

  const next = useCallback(() => {
    setResult(null);
    setOverrideOpen(false);
    setReason("");
    setReasonError(null);
    last.current.at = Date.now();
    resume();
  }, [resume]);

  // Pause decoding while a result is showing; plain successes return to the camera by themselves.
  useEffect(() => {
    if (!result) return undefined;
    pause();
    const view = describe(result);
    if (view.tone !== "good" || overrideOpen) return undefined;
    const id = setTimeout(next, AUTO_NEXT_MS);
    return () => clearTimeout(id);
  }, [result, overrideOpen, pause, next]);

  // No camera: go straight to the typed-code box.
  useEffect(() => {
    if (open && ["denied", "unavailable"].includes(scanner.status)) typedRef.current?.focus();
  }, [open, scanner.status]);

  useEffect(() => {
    if (!open) {
      setResult(null);
      setTyped("");
      setTypedError(null);
      setOverrideOpen(false);
    }
  }, [open]);

  const letInOnce = async () => {
    const view = describe(result);
    if (!reason.trim()) {
      setReasonError("Add a reason, for example “paying tomorrow”");
      return;
    }
    try {
      const data = await checkIn.mutateAsync({
        memberId: view.member._id,
        override: true,
        overrideReason: reason.trim(),
        method: "qr",
        idempotencyKey: newIdempotencyKey(),
      });
      setOverrideOpen(false);
      setResult({ ok: true, data: { ...data, action: data.alreadyCheckedIn ? "already_in" : data.returned ? "returned" : "checked_in" } });
      toast.success(`${data.member.name} let in once`, { description: `Reason: ${reason.trim()}` });
    } catch (e) {
      if (e.fields?.overrideReason) setReasonError(e.fields.overrideReason);
      else toast.error("Couldn't check in", { description: e.message });
    }
  };

  const view = result ? describe(result) : null;
  const tone = view ? TONE[view.tone] : null;
  const pending = view?.blocked?.membership?.state === "pending";
  const busy = scanMutation.isPending;

  return (
    <Dialog open={open} onClose={onClose} title="Scan a member QR code" description="Point the camera at the code in the member's app or on their card." size="md">
      <div className="flex flex-col gap-4">
        {!online && (
          <InlineAlert tone="offline" title="You're offline">
            Scans will work again when the connection is back.
          </InlineAlert>
        )}

        <div className="relative overflow-hidden rounded-tile bg-surface-3" style={{ aspectRatio: "4 / 3" }}>
          <video ref={scanner.videoRef} playsInline muted autoPlay aria-label="Camera preview" className={cn("size-full object-cover", scanner.status !== "scanning" && "opacity-0")} />
          {scanner.status === "scanning" && !view && (
            <div aria-hidden className="pointer-events-none absolute inset-[18%] rounded-[18px] border-[3px] border-hero-ink outline-solid outline-[999px] outline-black/35" />
          )}
          {scanner.status === "starting" && (
            <div className="absolute inset-0 grid place-items-center" role="status">
              <Skeleton className="absolute inset-0 rounded-none" />
              <p className="relative text-sm font-semibold text-ink-2">Starting the camera…</p>
            </div>
          )}
          {["denied", "unavailable", "error"].includes(scanner.status) && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-5 text-center">
              <Camera className="size-8 text-ink-3" aria-hidden />
              <p className="text-body-lg font-semibold text-ink">
                {scanner.status === "denied" ? "Camera access is blocked" : scanner.status === "unavailable" ? "No camera on this device" : "The camera didn't start"}
              </p>
              <p className="max-w-xs text-sm text-ink-3">
                {scanner.status === "denied"
                  ? "Allow the camera for this site in the browser settings, then try again. Or type the member code below."
                  : "Type the member code below, or plug in a barcode scanner."}
              </p>
              {scanner.status !== "unavailable" && (
                <Button variant="secondary" icon={RefreshCw} onClick={scanner.retry}>
                  Try again
                </Button>
              )}
            </div>
          )}
          {busy && !view && (
            <div className="absolute inset-x-0 bottom-0 bg-surface/90 px-4 py-2 text-center text-sm font-semibold text-ink" role="status">
              Checking…
            </div>
          )}
        </div>

        <div aria-live="polite">
          {view && (
            <section className={cn("rounded-tile p-4", tone.box)}>
              <div className="flex items-start gap-3">
                {view.member ? (
                  <Avatar name={view.member.name} src={view.member.profilePhoto} size="lg" />
                ) : (
                  <tone.Icon className={cn("mt-0.5 size-6 shrink-0", tone.icon)} aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-body-lg font-bold text-ink">
                    {view.member && <tone.Icon className={cn("size-4 shrink-0", tone.icon)} aria-hidden />}
                    {view.title}
                  </p>
                  <p className="mt-0.5 text-sm text-ink-2">{view.line}</p>
                  {view.member?.memberCode && <p className="mt-0.5 text-body-sm text-ink-3">{view.member.memberCode}</p>}
                </div>
              </div>

              {overrideOpen && (
                <Field className="mt-4" label="Reason for letting in once" hint="Saved with the visit so the owner can review it." error={reasonError}>
                  <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Paying tomorrow" maxLength={200} autoFocus />
                </Field>
              )}

              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {view.canUndo && (
                  <Button
                    variant="ghost"
                    icon={Undo2}
                    onClick={() =>
                      undo.mutate(result.data.attendance._id, {
                        onSuccess: () => {
                          toast.info(`Check-in for ${view.member.name} undone`);
                          next();
                        },
                        onError: (e) => toast.error("Couldn't undo", { description: e.message }),
                      })
                    }
                  >
                    Undo
                  </Button>
                )}
                {view.blocked?.canOverride &&
                  (overrideOpen ? (
                    <Button variant="secondary" icon={DoorOpen} onClick={letInOnce} loading={checkIn.isPending}>
                      Let in once
                    </Button>
                  ) : (
                    <>
                      <Button variant="secondary" icon={DoorOpen} onClick={() => setOverrideOpen(true)}>
                        Let in once
                      </Button>
                      <Button
                        variant="secondary"
                        icon={pending ? Wallet : RefreshCw}
                        onClick={() => {
                          onClose();
                          navigate(`/admin/members/${view.member._id}?action=${pending ? "pay" : "renew"}`);
                        }}
                      >
                        {pending ? "Collect payment" : "Renew plan"}
                      </Button>
                    </>
                  ))}
                {view.offer === "out" && (
                  <Button variant="secondary" icon={LogOut} loading={busy} onClick={() => submit(lastCode.current, "out")}>
                    Check out now
                  </Button>
                )}
                {view.offer === "in" && (
                  <Button variant="secondary" icon={LogIn} loading={busy} onClick={() => submit(lastCode.current, "in")}>
                    Check in again
                  </Button>
                )}
                <Button variant="primary" icon={ScanLine} onClick={next} autoFocus={!overrideOpen}>
                  Scan next
                </Button>
              </div>
            </section>
          )}
        </div>

        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            const code = typed.trim();
            if (!code) {
              setTypedError("Type a member code such as KFZ-0142");
              return;
            }
            // A barcode scanner types the full QR text; a person types a member code.
            submit(code, code.startsWith("KV1.") ? "auto" : "in");
          }}
          className="flex flex-col gap-2 border-t border-line pt-4 sm:flex-row sm:items-end"
        >
          <Field className="flex-1" label="Or type the member code" hint="A USB or Bluetooth barcode scanner can type here too." error={typedError}>
            <Input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder="KFZ-0142"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              enterKeyHint="go"
              ref={typedRef}
            />
          </Field>
          <Button type="submit" variant="secondary" icon={LogIn} loading={busy} disabled={!online} className="sm:mb-[26px]">
            Check in
          </Button>
        </form>
      </div>
    </Dialog>
  );
}
