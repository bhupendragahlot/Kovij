import { useEffect } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { Bell, Ellipsis, QrCode } from "lucide-react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { MEMBER_NAV } from "./nav";
import { useGym, useHome } from "./queries";
import { Avatar, ConfirmProvider, NavBar, NavBarLink, OfflineBanner, RailLink, Toaster } from "../../shared/ui";
import { useScrolled } from "../../shared/hooks/useScrolled";
import { KMark } from "../../layouts/crm/BrandMark";
import { cn } from "../../shared/lib/cn";

function GymMark({ gym, className }) {
  return gym?.logoUrl ? (
    <img src={gym.logoUrl} alt="" className={cn("rounded-[9px] bg-white object-contain p-0.5", className)} />
  ) : (
    <KMark className={className} />
  );
}

/**
 * Signed-in member app (Material 3 adaptive navigation):
 *   phones (< 600)    top app bar + bottom navigation bar, Pass as the filled centre item
 *   600 – 1023        navigation rail with the Pass button on top
 *   1024 and wider    labelled sidebar
 * Safe areas (notch, home indicator, landscape cut-outs) are padded on every bar.
 */
export default function MemberAppLayout() {
  const { member, loading } = useMemberAuth();
  const location = useLocation();
  const gym = useGym().data;
  const home = useHome({ enabled: Boolean(member) });
  const unread = home.data?.unread || 0;
  const scrolled = useScrolled();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (loading) return <div className="kv-app min-h-dvh bg-canvas" />;
  if (!member) return <Navigate to={`/member/login?next=${encodeURIComponent(location.pathname)}`} replace />;

  const tabs = MEMBER_NAV.filter((n) => n.tab);
  const isMoreActive = !tabs.some((t) => location.pathname.startsWith(t.to)) && location.pathname !== "/member/pass";
  const gymName = gym?.gymName || "Kovij Fitness Zone";
  const unreadHint = unread ? `${unread} unread` : undefined;

  return (
    <ConfirmProvider>
      <div className="kv-app min-h-dvh bg-canvas font-ui text-ink">
        <Toaster />

        {/* 1024+: labelled sidebar */}
        <aside aria-label="Member menu" className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col bg-rail text-rail-ink lg:flex">
          <Link to="/member/home" className="flex h-16 items-center gap-2.5 px-5">
            <GymMark gym={gym} className="size-9 shrink-0" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-body-lg font-extrabold">{gymName}</span>
              <span className="block text-label text-rail-ink-2">Member</span>
            </span>
          </Link>
          <div className="px-4 pb-3">
            <Link
              to="/member/pass"
              className="state-layer flex h-12 items-center justify-center gap-2 rounded-card bg-brand font-bold text-on-brand shadow-float"
            >
              <QrCode className="size-5" aria-hidden />
              Check-in pass
            </Link>
          </div>
          <nav className="flex-1 overflow-y-auto px-3 py-2">
            <ul className="flex flex-col gap-0.5">
              {MEMBER_NAV.map((item) => (
                <li key={item.to}>
                  <NavLink
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "state-layer flex h-11 items-center gap-3 rounded-full px-4 text-sm font-semibold transition-colors",
                        isActive ? "bg-brand text-on-brand" : "text-rail-ink-2 hover:text-rail-ink"
                      )
                    }
                  >
                    <item.icon className="size-5" aria-hidden />
                    <span className="flex-1">{item.label}</span>
                    {item.badge === "unread" && unread > 0 && (
                      <span className="tabular rounded-full bg-brand px-2 text-label font-bold text-on-brand">
                        {unread}
                        <span className="sr-only"> unread</span>
                      </span>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* 600 – 1023: navigation rail */}
        <nav
          aria-label="Main"
          className="fixed inset-y-0 left-0 z-40 hidden w-20 flex-col items-center overflow-y-auto border-r border-line bg-surface pb-4 pl-[env(safe-area-inset-left)] pt-[calc(env(safe-area-inset-top)+0.75rem)] [box-sizing:content-box] [scrollbar-width:none] sm:flex lg:hidden"
        >
          <Link
            to="/member/pass"
            aria-label="Check-in pass"
            className="state-layer mb-4 grid size-14 shrink-0 place-items-center rounded-card bg-brand text-on-brand shadow-float"
          >
            <QrCode className="size-6" aria-hidden />
          </Link>
          <ul className="flex w-full flex-col gap-1">
            {MEMBER_NAV.map((item) => (
              <RailLink
                key={item.to}
                to={item.to}
                icon={item.icon}
                label={item.label}
                count={item.badge === "unread" ? unread : 0}
                srHint={item.badge === "unread" ? unreadHint : undefined}
              />
            ))}
          </ul>
        </nav>

        <div className="sm:pl-[calc(5rem+env(safe-area-inset-left))] lg:pl-[248px]">
          {/* Top app bar (phones and tablets): flat at rest, tinted with a hairline once content scrolls under it. */}
          <header
            className={cn(
              "sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] transition-colors duration-200 lg:hidden",
              scrolled ? "border-line bg-surface" : "border-transparent bg-canvas"
            )}
          >
            <div className="mx-auto flex h-14 max-w-2xl items-center gap-1 px-2 sm:px-4">
              <Link
                to="/member/home"
                className="state-layer touch-target flex min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pl-2 pr-3"
                aria-label={`${gymName}, home`}
              >
                <GymMark gym={gym} className="size-8 shrink-0 sm:hidden" />
                <span className="truncate text-title font-extrabold">{gymName}</span>
              </Link>
              <Link
                to="/member/notifications"
                aria-label={unread ? `Updates, ${unread} unread` : "Updates"}
                className="state-layer touch-target relative grid size-10 place-items-center rounded-full text-ink-2"
              >
                <Bell className="size-6" aria-hidden />
                {unread > 0 && <span className="absolute right-2 top-2 size-2.5 rounded-full border-2 border-canvas bg-brand" aria-hidden />}
              </Link>
              <Link to="/member/profile" aria-label="Profile" className="state-layer touch-target grid size-10 place-items-center rounded-full">
                <Avatar name={member.name || ""} src={member.profilePhoto} size="sm" />
              </Link>
            </div>
          </header>

          <OfflineBanner>Showing what you saw last. Your check-in pass still works.</OfflineBanner>
          <main className="mx-auto w-full max-w-2xl px-4 pb-[calc(var(--kv-navbar-h)+env(safe-area-inset-bottom)+1.5rem)] pt-3 sm:px-6 sm:pb-10 sm:pt-6 lg:max-w-3xl lg:px-8 lg:pt-8">
            <Outlet />
          </main>
        </div>

        {/* Phones: navigation bar, the pass in the middle under the thumb */}
        <NavBar>
          <NavBarLink to={tabs[0].to} icon={tabs[0].icon} label={tabs[0].label} />
          <NavBarLink to={tabs[1].to} icon={tabs[1].icon} label={tabs[1].label} />
          <NavBarLink to="/member/pass" icon={QrCode} label="Pass" primary />
          <NavBarLink to={tabs[2].to} icon={tabs[2].icon} label={tabs[2].label} />
          <NavBarLink to="/member/more" icon={Ellipsis} label="More" active={isMoreActive} dot={unread > 0} srHint={unreadHint} />
        </NavBar>
      </div>
    </ConfirmProvider>
  );
}
