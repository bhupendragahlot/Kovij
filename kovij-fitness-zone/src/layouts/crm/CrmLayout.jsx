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
 * Staff app shell (Material 3 window sizes).
 *   compact  (< 600)   top app bar + bottom navigation bar, 16 px page margins
 *   medium+  (600+)    80 px icon rail + top app bar with search, 24 px margins
 *   large    (1280+)   labelled rail (collapsible), 32 px margins
 */
export default function CrmLayout() {
  const collapsed = useSelector(selectSidebarCollapsed);
  return (
    // --kv-rail-w lets fixed elements (sticky form bars) line up with the rail on desktop.
    <div className="kv-app min-h-dvh bg-canvas font-ui text-ink" style={{ "--kv-rail-w": collapsed ? "80px" : "248px" }}>
      <a
        href="#main"
        className="sr-only z-[70] rounded-control bg-brand px-4 py-2 font-semibold text-on-brand focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <Sidebar />
      <div className="sm:pl-[calc(5rem+env(safe-area-inset-left))] xl:pl-[calc(var(--kv-rail-w)+env(safe-area-inset-left))]">
        <Topbar />
        <OfflineBanner />
        <main id="main" tabIndex={-1} className="mx-auto w-full max-w-[1400px] px-4 pb-[calc(var(--kv-navbar-h)+env(safe-area-inset-bottom)+1.5rem)] pt-3 outline-none sm:px-6 sm:pb-12 sm:pt-6 xl:px-8">
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
