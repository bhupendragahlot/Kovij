import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Camera QR scanning, shared by the desk scan sheet and the entrance kiosk.
 *
 * Uses the browser's BarcodeDetector when it can read QR codes (Chrome on Android, Edge),
 * otherwise decodes camera frames with jsQR, which is loaded only when needed.
 *
 *   const scanner = useQrScanner({ enabled: open, facingMode: "environment", onDetect: (text) => … });
 *   <video ref={scanner.videoRef} playsInline muted />
 *
 * status: "idle" | "starting" | "scanning" | "denied" (permission refused) |
 *         "unavailable" (no camera, or not a secure page) | "error"
 * `pause()` stops reporting codes while a result is on screen; the camera keeps running so the
 * next scan is instant. `retry()` starts the camera again after an error.
 */
export function useQrScanner({ enabled, facingMode = "environment", deviceId, onDetect, interval = 180 }) {
  const videoRef = useRef(null);
  const onDetectRef = useRef(onDetect);
  const pausedRef = useRef(false);
  const [status, setStatus] = useState("idle");
  const [devices, setDevices] = useState([]);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    onDetectRef.current = onDetect;
  }, [onDetect]);

  useEffect(() => {
    if (!enabled) return undefined;
    const video = videoRef.current;
    let cancelled = false;
    let stream = null;
    let timer = null;

    const stop = () => {
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      if (video) video.srcObject = null;
    };

    (async () => {
      if (!video || !navigator.mediaDevices?.getUserMedia || window.isSecureContext === false) {
        setStatus("unavailable");
        return;
      }
      setStatus("starting");
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: deviceId
            ? { deviceId: { exact: deviceId } }
            : { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
      } catch (err) {
        if (cancelled) return;
        const name = err?.name;
        if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied");
        else if (name === "NotFoundError" || name === "OverconstrainedError" || name === "NotReadableError") setStatus("unavailable");
        else setStatus("error");
        return;
      }
      if (cancelled) return stop();

      video.srcObject = stream;
      try {
        await video.play();
      } catch {
        /* autoplay refused: a muted inline video still delivers frames */
      }
      navigator.mediaDevices
        .enumerateDevices?.()
        .then((list) => !cancelled && setDevices(list.filter((d) => d.kind === "videoinput")))
        .catch(() => {});

      const detect = await createDetector();
      if (cancelled) return stop();
      setStatus("scanning");

      const tick = async () => {
        if (cancelled) return;
        if (!pausedRef.current && video.readyState >= 2) {
          try {
            const text = await detect(video);
            if (text && !cancelled && !pausedRef.current) onDetectRef.current?.(text);
          } catch {
            /* an unreadable frame: try the next one */
          }
        }
        if (!cancelled) timer = setTimeout(tick, interval);
      };
      tick();
    })();

    return () => {
      cancelled = true;
      stop();
      setStatus("idle");
    };
  }, [enabled, facingMode, deviceId, interval, attempt]);

  const pause = useCallback(() => {
    pausedRef.current = true;
  }, []);
  const resume = useCallback(() => {
    pausedRef.current = false;
  }, []);
  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { videoRef, status, devices, pause, resume, retry };
}

/** Returns `(video) => Promise<string|null>` using the fastest decoder this browser has. */
async function createDetector() {
  if (typeof window !== "undefined" && "BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        return async (video) => (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch {
      /* fall back to jsQR */
    }
  }
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  return (video) => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    // Decode a downscaled frame: a phone-screen QR is still readable and tablets stay responsive.
    const scale = Math.min(1, 640 / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
    // attemptBoth also reads light-on-dark codes (phones in dark mode).
    return jsQR(data, canvas.width, canvas.height, { inversionAttempts: "attemptBoth" })?.data || null;
  };
}
