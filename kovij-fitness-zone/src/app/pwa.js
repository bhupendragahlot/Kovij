import { store } from "./store";
import { toastActionRegistry, toastAdded } from "../shared/ui/toast/toastSlice";

/**
 * Register the service worker (production builds only). When a new version is deployed the
 * desk sees "A new version is ready" with a Reload button instead of being switched mid-task.
 */
export async function registerServiceWorker() {
  if (import.meta.env.DEV || !("serviceWorker" in navigator)) return;
  const { registerSW } = await import("virtual:pwa-register");
  const updateSW = registerSW({
    onNeedRefresh() {
      const id = "sw-update";
      toastActionRegistry.set(id, () => updateSW(true));
      store.dispatch(
        toastAdded({
          id,
          tone: "neutral",
          title: "A new version is ready",
          description: "Reload when you're between tasks.",
          actionLabel: "Reload",
          duration: 10 * 60_000,
        })
      );
    },
  });
}
