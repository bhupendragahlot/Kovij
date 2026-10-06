import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { CloudOff, X } from "lucide-react";
import { useQrPass, useMyMembership, useGym } from "../queries";
import { cardState } from "../cardState";
import { Button, ErrorState, Skeleton } from "../../../shared/ui";
import { formatDate, formatRelativeTime } from "../../../shared/lib/format";

export const PASS_STORAGE_KEY = "kv.memberPass";

function loadSavedPass() {
  try {
    return JSON.parse(localStorage.getItem(PASS_STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

/** Keep the screen on while the pass is showing, so it doesn't dim at the scanner. */
function useWakeLock() {
  useEffect(() => {
    let lock;
    let cancelled = false;
    const request = async () => {
      try {
        if ("wakeLock" in navigator && document.visibilityState === "visible") lock = await navigator.wakeLock.request("screen");
        if (cancelled) lock?.release();
      } catch {
        /* not supported or denied: the pass still works */
      }
    };
    request();
    const onVisible = () => document.visibilityState === "visible" && request();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      lock?.release().catch(() => {});
    };
  }, []);
}

/** Full-screen check-in pass: the QR the desk or kiosk scans, with the member code as a fallback. */
export default function PassPage() {
  const navigate = useNavigate();
  const pass = useQrPass();
  const standing = useMyMembership().data;
  const gym = useGym().data;
  const [saved] = useState(loadSavedPass);
  const [svg, setSvg] = useState("");
  useWakeLock();

  // The latest pass from the server, else the one saved on this phone (works without signal).
  const live = pass.data?.token ? { token: pass.data.token, memberCode: pass.data.memberCode, name: pass.data.name, savedAt: new Date().toISOString() } : null;
  const current = live || saved;

  useEffect(() => {
    if (!live) return;
    try {
      localStorage.setItem(PASS_STORAGE_KEY, JSON.stringify(live));
    } catch {
      /* storage full or blocked: the pass still shows */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live?.token]);

  useEffect(() => {
    if (!current?.token) return;
    QRCode.toString(current.token, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } }).then(setSvg).catch(() => setSvg(""));
  }, [current?.token]);

  const status = useMemo(() => (standing ? cardState(standing) : null), [standing]);
  const code = current?.memberCode || "";

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center overflow-y-auto bg-hero px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))] text-hero-ink">
      <div className="flex w-full max-w-sm items-center justify-between">
        <p className="text-body-lg font-bold">{gym?.gymName || "Kovij Fitness Zone"}</p>
        <button type="button" onClick={() => navigate(-1)} aria-label="Close the pass" className="state-layer touch-target grid size-12 place-items-center rounded-full">
          <X className="size-6" aria-hidden />
        </button>
      </div>

      <div className="mt-6 flex w-full max-w-sm flex-col items-center">
        <h1 className="text-headline-sm font-bold">Check-in pass</h1>
        <p className="mt-1 text-body-lg text-hero-ink-2">Show this at the desk or the entrance scanner.</p>

        <div className="mt-6 w-full rounded-card bg-white p-5 text-neutral-900 shadow-pop">
          {pass.isPending && !saved ? (
            <Skeleton className="aspect-square w-full" />
          ) : !current ? (
            <ErrorState compact error={pass.error} onRetry={() => pass.refetch()} title="Couldn’t load your pass" />
          ) : (
            <>
              {svg ? <div className="mx-auto aspect-square w-full max-w-[18rem] [&>svg]:size-full" role="img" aria-label={`QR code for member ${code}`} dangerouslySetInnerHTML={{ __html: svg }} /> : <Skeleton className="aspect-square w-full" />}
              <p className="mt-4 text-center text-title-lg font-bold">{current.name}</p>
              <p className="tabular mt-1 text-center text-headline font-bold tracking-[0.18em]" aria-label={`Member code ${code.split("").join(" ")}`}>
                {code}
              </p>
            </>
          )}
        </div>

        {status && (
          <p className="mt-5 text-center text-body-lg">
            <span className="font-semibold">{status.badge}</span>
            {standing.membership?.endDate && ["active", "ending"].includes(status.key) && <span className="text-hero-ink-2"> · valid until {formatDate(standing.membership.endDate)}</span>}
          </p>
        )}
        {!live && saved && (
          <p className="mt-3 flex items-center gap-2 text-body-sm text-hero-ink-2">
            <CloudOff className="size-4" aria-hidden />
            Offline: showing the pass saved {formatRelativeTime(saved.savedAt)}.
          </p>
        )}
        <p className="mt-6 text-center text-body-sm text-hero-ink-2">Can’t scan? Tell the desk your code. Turn the screen brightness up if the scanner struggles.</p>
        <Button variant="secondary" className="mt-6" onClick={() => navigate(-1)}>
          Done
        </Button>
      </div>
    </div>
  );
}
