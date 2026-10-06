import { useEffect } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Bell, Ellipsis, QrCode } from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { MEMBER_NAV } from "./nav";
import { useGym, useHome } from "./queries";
import { Avatar, ConfirmProvider, OfflineBanner, Toaster } from "../../shared/ui";
import { KMark } from "../../layouts/crm/BrandMark";
import { cn } from "../../shared/lib/cn";

function GymMark({ gym, className }) {
  return gym?.logoUrl ? <img src={gym.logoUrl} alt="" className={cn("rounded-[9px] bg-white object-contain p-0.5", className)} /> : <KMark className={className} />;
}

/** Signed-in member app: sidebar on desktop; top bar, bottom bar and the pass button on phones. */
export default function MemberAppLayout() {
  const { member, loading } = useMemberAuth();
  const location = useLocation();
  const gym = useGym().data;
  const home = useHome({ enabled: Boolean(member) });
  const unread = home.data?.unread || 0;

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) return <div className="kv-app min-h-dvh bg-canvas" />;
  if (!member) return <Navigate to={`/member/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const tabs = MEMBER_NAV.filter((n) => n.tab);
  const isMoreActive = !tabs.some((t) => location.pathname.startsWith(t.to)) && location.pathname !== "/member/pass";

  return (
    <ConfirmProvider>
    <div className="kv-app min-h-dvh bg-canvas font-ui text-ink">
      <Toaster />
      {/* Desktop sidebar */}
      <aside aria-label="Member menu" className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-rail text-rail-ink lg:flex">
        <Link to="/member/home" className="flex h-16 items-center gap-2.5 px-5">
          <GymMark gym={gym} className="size-9 shrink-0" />
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[15px] font-extrabold">{gym?.gymName || "Kovij Fitness Zone"}</span>
            <span className="block text-xs text-rail-ink-2">Member</span>
          </span>
        </Link>
        <nav className="flex-1 overflow-y-auto px-3 py-2">
          <ul className="flex flex-col gap-1">
            {MEMBER_NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) =>
                    cn("flex h-11 items-center gap-3 rounded-full px-4 text-[15px] font-medium transition-colors", isActive ? "bg-brand text-on-brand" : "text-rail-ink-2 hover:bg-rail-2 hover:text-rail-ink")
                  }
                >
                  <item.icon className="size-5" aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.badge === "unread" && unread > 0 && (
                    <span className="tabular rounded-full bg-brand px-2 text-xs font-bold text-on-brand">
                      {unread}
                      <span className="sr-only"> unread</span>
                    </span>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="p-4">
          <Link to="/member/pass" className="flex h-12 items-center justify-center gap-2 rounded-full bg-brand font-bold text-on-brand hover:opacity-90">
            <QrCode className="size-5" aria-hidden />
            Check-in pass
          </Link>
        </div>
      </aside>

      {/* Phone top bar */}
      <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex h-16 max-w-2xl items-center gap-3 px-4">
          <Link to="/member/home" className="flex min-w-0 flex-1 items-center gap-2.5" aria-label="Home">
            <GymMark gym={gym} className="size-9 shrink-0" />
            <span className="truncate text-[15px] font-extrabold">{gym?.gymName || "Kovij Fitness Zone"}</span>
          </Link>
          <Link to="/member/notifications" aria-label={unread ? `Updates, ${unread} unread` : "Updates"} className="relative grid size-11 place-items-center rounded-full text-ink-2 hover:bg-surface">
            <Bell className="size-5" aria-hidden />
            {unread > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full border-2 border-canvas bg-brand" aria-hidden />}
          </Link>
          <Link to="/member/profile" aria-label="Profile">
            <Avatar name={member.name || ""} src={member.profilePhoto} size="sm" />
          </Link>
        </div>
      </header>

      <div className="lg:pl-[248px]">
        <OfflineBanner>Showing what you saw last. Your check-in pass still works.</OfflineBanner>
        <main className="mx-auto w-full max-w-2xl px-4 pb-32 pt-5 lg:max-w-3xl lg:px-8 lg:pb-12 lg:pt-8">
          <Outlet />
        </main>
      </div>

      {/* Phone bottom bar with the pass in thumb reach */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
        <ul className="mx-auto grid h-16 max-w-2xl grid-cols-5">
          <BottomTab item={tabs[0]} />
          <BottomTab item={tabs[1]} />
          <li className="relative">
            <Link
              to="/member/pass"
              className="absolute -top-6 left-1/2 flex size-16 -translate-x-1/2 flex-col items-center justify-center rounded-full bg-brand text-on-brand shadow-pop ring-4 ring-canvas"
            >
              <QrCode className="size-6" aria-hidden />
              <span className="text-[11px] font-bold">Pass</span>
            </Link>
          </li>
          <BottomTab item={tabs[2]} />
          <li>
            <NavLink to="/member/more" className={cn("flex h-full flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", isMoreActive ? "text-ink" : "text-ink-3")}>
              <span className="relative">
                <Ellipsis className="size-6" aria-hidden />
                {unread > 0 && <span className="absolute -right-1 top-0 size-2 rounded-full bg-brand" aria-hidden />}
              </span>
              More
            </NavLink>
          </li>
        </ul>
      </nav>
    </div>
    </ConfirmProvider>
  );
}

function BottomTab({ item }) {
  return (
    <li>
      <NavLink to={item.to} className={({ isActive }) => cn("flex h-full flex-col items-center justify-center gap-0.5 text-[12px] font-semibold", isActive ? "text-ink" : "text-ink-3")}>
        <item.icon className="size-6" aria-hidden />
        {item.label}
      </NavLink>
    </li>
  );
}
