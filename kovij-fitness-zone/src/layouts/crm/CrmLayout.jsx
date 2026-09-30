import { Suspense } from "react";
import { Outlet, ScrollRestoration } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectSidebarCollapsed } from "../../app/uiSlice";
import { OfflineBanner, SkeletonList, Toaster } from "../../shared/ui";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { BottomNav } from "./BottomNav";
import { CommandPalette } from "./CommandPalette";

/**
 * Staff app shell.
 *   phone  (<768)   top bar + bottom tab bar, content full-bleed with 16px gutters
 *   tablet (768+)   icon rail + top bar
 *   desktop(1280+)  labelled rail (collapsible) + top bar with search
 */
export default function CrmLayout() {
  const collapsed = useSelector(selectSidebarCollapsed);
  return (
    // --kv-rail-w lets fixed elements (sticky form bars) line up with the rail on desktop.
    <div className="kv-app min-h-dvh bg-canvas font-ui text-ink" style={{ "--kv-rail-w": collapsed ? "76px" : "248px" }}>
      <a
        href="#main"
        className="sr-only z-[70] rounded-control bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="md:pl-[76px] xl:pl-[var(--kv-rail-w)]">
        <Topbar />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 pb-28 pt-5 outline-none md:px-6 md:pb-12 xl:px-8">
          <Suspense fallback={<SkeletonList rows={6} className="pt-4" />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <CommandPalette />
      <Toaster />
      <ScrollRestoration />
    </div>
  );
}
