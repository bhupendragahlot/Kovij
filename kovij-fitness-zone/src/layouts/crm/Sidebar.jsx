import { NavLink } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { cn } from "../../shared/lib/cn";
import { selectRole } from "../../features/auth/sessionSlice";
import { selectSidebarCollapsed, sidebarToggled } from "../../app/uiSlice";
import { visibleNav } from "./navigation";
import { BrandMark } from "./BrandMark";
import { useSettings } from "../../features/settings/api";

/**
 * Iron rail. Tablet: icons only (76px). Desktop: labels (248px), collapsible to icons.
 * Hidden on phones, where the bottom bar takes over.
 */
export function Sidebar() {
  const dispatch = useDispatch();
  const role = useSelector(selectRole);
  const collapsedPref = useSelector(selectSidebarCollapsed);
  const groups = visibleNav(role);

  const logoUrl = useSettings().data?.logoUrl;
  return (
    <aside
      aria-label="Main"
      data-collapsed={collapsedPref || undefined}
      className="group/rail fixed inset-y-0 left-0 z-40 hidden w-[76px] flex-col bg-rail text-rail-ink md:flex xl:w-[248px] xl:data-[collapsed]:w-[76px] dark:border-r dark:border-line"
    >
      <div className="flex h-16 shrink-0 items-center px-5 xl:px-5">
        {/* Visibility lives on wrappers so it never competes with BrandMark's own display class. */}
        <span className="xl:hidden xl:group-data-[collapsed]/rail:block">
          <BrandMark compact logoUrl={logoUrl} />
        </span>
        <span className="hidden xl:block xl:group-data-[collapsed]/rail:hidden">
          <BrandMark logoUrl={logoUrl} />
        </span>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-2 [scrollbar-width:thin]">
        {groups.map((group) => (
          <div key={group.label} className="mb-5">
            <p className="mb-1.5 hidden px-3 text-xs font-semibold text-rail-ink-2 xl:block xl:group-data-[collapsed]/rail:hidden">{group.label}</p>
            <ul className="flex flex-col gap-1">
              {group.items.map((item) => (
                <li key={item.id}>
                  <NavLink
                    to={item.to}
                    end={item.end}
                    title={item.label}
                    className={({ isActive }) =>
                      cn(
                        "flex h-11 items-center gap-3 rounded-full px-3.5 text-sm font-semibold transition-colors duration-150",
                        "justify-center xl:justify-start xl:group-data-[collapsed]/rail:justify-center",
                        isActive ? "bg-brand text-on-brand" : "text-rail-ink-2 hover:bg-rail-2 hover:text-rail-ink"
                      )
                    }
                  >
                    <item.icon className="size-[19px] shrink-0" aria-hidden />
                    <span className="sr-only xl:not-sr-only xl:group-data-[collapsed]/rail:sr-only">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="hidden shrink-0 p-3 xl:block">
        <button
          type="button"
          onClick={() => dispatch(sidebarToggled())}
          className="flex h-10 w-full items-center gap-3 rounded-full px-3.5 text-sm font-semibold text-rail-ink-2 hover:bg-rail-2 hover:text-rail-ink group-data-[collapsed]/rail:justify-center"
          aria-label={collapsedPref ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsedPref ? <PanelLeftOpen className="size-[18px]" aria-hidden /> : <PanelLeftClose className="size-[18px]" aria-hidden />}
          <span className="group-data-[collapsed]/rail:sr-only">Collapse</span>
        </button>
      </div>
    </aside>
  );
}
