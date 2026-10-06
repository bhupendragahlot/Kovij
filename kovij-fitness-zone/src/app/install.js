import { useSyncExternalStore } from "react";
import { onAppChange } from "./appIdentity";

/**
 * Installing the app from our own buttons. Chrome, Edge and Android fire `beforeinstallprompt`
 * once the page is installable; we keep it so an "Install" button can open the browser's install
 * dialog later. iPhones and iPads have no such event: Safari's Share → "Add to Home Screen" is
 * the only way, so the buttons show those steps instead.
 */
let deferred = null;
let installedNow = false;
const listeners = new Set();
let snapshot = null;

const notify = () => {
  snapshot = null;
  listeners.forEach((fn) => fn());
};

export const isStandalone = () =>
  typeof window !== "undefined" && (window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true);

export const isIos = () =>
  typeof navigator !== "undefined" && (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1));

/** Call once at start-up, before React renders, so the event isn't missed. */
export function initInstallPrompt() {
  if (typeof window === "undefined") return;
  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's own offer for our buttons (the address-bar install icon stays).
    e.preventDefault();
    deferred = e;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    installedNow = true;
    notify();
  });
  // The page switched between the member app and the desk: an offer for the other app is stale.
  onAppChange(() => {
    deferred = null;
    notify();
  });
}

/** Opens the browser's install dialog. Resolves "accepted", "dismissed" or "unavailable". */
export async function promptInstall() {
  if (!deferred) return "unavailable";
  const event = deferred;
  deferred = null;
  notify();
  await event.prompt();
  const { outcome } = await event.userChoice;
  return outcome;
}

function getSnapshot() {
  if (!snapshot) {
    const installed = installedNow || isStandalone();
    snapshot = { installed, canPrompt: Boolean(deferred) && !installed, ios: !installed && isIos() };
  }
  return snapshot;
}

const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));

/**
 * { installed, canPrompt, ios }: show an Install button when `canPrompt`, Add to Home Screen steps
 * when `ios`, and nothing when `installed` (already running as the app) or neither is possible.
 */
export function useInstallState() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
