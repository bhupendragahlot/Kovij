import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Ellipsis } from "lucide-react";
import { cn } from "../../shared/lib/cn";
import { selectRole } from "../../features/auth/sessionSlice";
import { Dialog } from "../../shared/ui";
import { flatNav } from "./navigation";

const tabClass = ({ isActive }) =>
  cn(
    "flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-2 pb-1 text-[11px] font-semibold",
    isActive ? "text-ink" : "text-ink-3"
  );

/**
 * Phone navigation: four tabs, Check-in as the raised centre action (the desk's most frequent
 * task, in thumb reach), and "More" for everything else.
 */
export function BottomNav() {
  const role = useSelector(selectRole);
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const items = flatNav(role);
  const tabs = items.filter((i) => i.mobile === "tab");
  const primary = items.find((i) => i.mobile === "primary");
  const more = items.filter((i) => i.mobile === "more");
  const moreActive = more.some((i) => location.pathname.startsWith(i.to));

  const [left, right] = [tabs.slice(0, 2), tabs.slice(2)];

  return (
    <>
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md md:hidden"
      >
        <ul className="flex h-16 items-stretch px-1">
          {left.map((item) => (
            <li key={item.id} className="flex flex-1">
              <NavLink to={item.to} end={item.end} className={tabClass}>
                <item.icon className="size-[22px]" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
          {primary && (
            <li className="flex flex-1 justify-center">
              <NavLink
                to={primary.to}
                className={({ isActive }) =>
                  cn(
                    "-mt-5 flex size-16 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-bold shadow-float ring-4 ring-canvas",
                    isActive ? "bg-ink text-canvas" : "bg-brand text-on-brand"
                  )
                }
              >
                <primary.icon className="size-6" aria-hidden />
                {primary.label}
              </NavLink>
            </li>
          )}
          {right.map((item) => (
            <li key={item.id} className="flex flex-1">
              <NavLink to={item.to} className={tabClass}>
                <item.icon className="size-[22px]" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
          <li className="flex flex-1">
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-haspopup="dialog"
              className={tabClass({ isActive: moreActive })}
            >
              <Ellipsis className="size-[22px]" aria-hidden />
              More
            </button>
          </li>
        </ul>
      </nav>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="grid grid-cols-3 gap-2 pb-2">
          {more.map((item) => (
            <li key={item.id}>
              <NavLink
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className={({ isActive }) =>
                  cn(
                    "flex aspect-square flex-col items-center justify-center gap-2 rounded-tile text-sm font-semibold",
                    isActive ? "bg-brand text-on-brand" : "bg-surface-2 text-ink"
                  )
                }
              >
                <item.icon className="size-6" aria-hidden />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
