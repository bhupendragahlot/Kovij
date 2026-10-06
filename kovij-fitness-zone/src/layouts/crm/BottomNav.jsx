import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { Ellipsis } from "lucide-react";
import { cn } from "../../shared/lib/cn";
import { selectRole } from "../../features/auth/sessionSlice";
import { Dialog, NavBar, NavBarButton, NavBarLink } from "../../shared/ui";
import { flatNav } from "./navigation";

/**
 * Phone navigation bar (< 600 px): four destinations, Check-in as the filled centre item (the
 * desk's most frequent task, in thumb reach), and "More" for everything else in a bottom sheet.
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
      <NavBar>
        {left.map((item) => (
          <NavBarLink key={item.id} to={item.to} end={item.end} icon={item.icon} label={item.label} />
        ))}
        {primary && <NavBarLink to={primary.to} icon={primary.icon} label={primary.label} primary />}
        {right.map((item) => (
          <NavBarLink key={item.id} to={item.to} end={item.end} icon={item.icon} label={item.label} />
        ))}
        <NavBarButton icon={Ellipsis} label="More" active={moreActive} aria-haspopup="dialog" onClick={() => setMoreOpen(true)} />
      </NavBar>

      <Dialog open={moreOpen} onClose={() => setMoreOpen(false)} title="More">
        <ul className="grid grid-cols-4 gap-x-1 gap-y-2 pb-1">
          {more.map((item) => (
            <li key={item.id} className="min-w-0">
              <NavLink
                to={item.to}
                onClick={() => setMoreOpen(false)}
                className="state-layer no-callout flex flex-col items-center gap-1.5 rounded-tile px-1 py-2 text-center"
              >
                {({ isActive }) => (
                  <>
                    <span className={cn("grid size-12 place-items-center rounded-full", isActive ? "bg-brand-soft text-brand-ink" : "bg-surface-2 text-ink-2")}>
                      <item.icon className="size-6" aria-hidden />
                    </span>
                    <span
                      className={cn("line-clamp-2 w-full break-words text-label leading-tight", isActive ? "font-bold text-ink" : "font-semibold text-ink-2")}
                    >
                      {item.sheetLabel || item.label}
                    </span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </Dialog>
    </>
  );
}
