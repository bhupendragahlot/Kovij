import { useEffect, useRef, useState } from "react";

let gisLoading = null;

/** Google Identity Services (the "Sign in with Google" library), loaded once, on demand. */
function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  gisLoading ||= new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => (window.google?.accounts?.id ? resolve(window.google) : reject(new Error("Google sign-in didn’t load.")));
    script.onerror = () => {
      gisLoading = null;
      reject(new Error("Couldn’t load Google sign-in. Check your connection and try again."));
    };
    document.head.appendChild(script);
  });
  return gisLoading;
}

/**
 * Google's own "Continue with Google" button for our OAuth client. Google shows its account
 * picker and hands back an ID token (`credential`), which the server verifies.
 */
export function GoogleButton({ clientId, onCredential, onError, busy = false }) {
  const host = useRef(null);
  const handlers = useRef({ onCredential, onError });
  handlers.current = { onCredential, onError };
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleIdentity()
      .then((google) => {
        if (cancelled || !host.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => handlers.current.onCredential(response.credential),
          ux_mode: "popup",
          auto_select: false,
          context: "signin",
          itp_support: true,
        });
        // Google's button takes a width in px (200–400).
        const width = Math.round(Math.min(400, Math.max(200, host.current.offsetWidth || 320)));
        google.accounts.id.renderButton(host.current, { type: "standard", theme: "outline", size: "large", text: "continue_with", shape: "rectangular", logo_alignment: "center", width });
        setReady(true);
      })
      .catch((err) => !cancelled && handlers.current.onError?.(err.message));
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  return (
    <div className="relative" aria-busy={busy || undefined}>
      <div ref={host} className="flex min-h-11 w-full justify-center" />
      {!ready && <div className="absolute inset-0 animate-pulse rounded-lg bg-white/90" aria-hidden />}
      {busy && <p className="mt-2 text-center text-sm text-neutral-400" role="status">Signing you in…</p>}
    </div>
  );
}
