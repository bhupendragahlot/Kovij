import { NavLink } from "react-router-dom";
import { cn } from "../lib/cn";

/**
 * Material 3 navigation bar (phones) and navigation rail (600 px and wider) items: a 24 px icon
 * in a 56 × 32 indicator pill, the label underneath. `primary` keeps the pill filled with the
 * brand colour (the app's main action: Pass for members, Check-in for staff).
 */
function ItemBody({ icon: Icon, label, active, primary, dot, count }) {
  return (
    <>
      <span
        className={cn(
          "relative grid h-8 w-14 shrink-0 place-items-center rounded-full transition-colors duration-200",
          primary
            ? "bg-brand text-on-brand group-active:opacity-85"
            : active
              ? "bg-brand-soft text-brand-ink"
              : "text-ink-2 group-hover:bg-surface-2 group-active:bg-surface-3"
        )}
      >
        <Icon className="size-6" strokeWidth={active || primary ? 2.25 : 2} aria-hidden />
        {count > 0 ? (
          <span className="tabular absolute -top-1 right-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-label-sm font-bold text-on-brand ring-2 ring-surface">
            {count > 99 ? "99+" : count}
          </span>
        ) : (
          dot && <span className="absolute right-3.5 top-1 size-2 rounded-full bg-brand ring-2 ring-surface" aria-hidden />
        )}
      </span>
      <span className={cn("max-w-full truncate px-1 text-label", active || primary ? "font-bold text-ink" : "font-semibold text-ink-2")}>{label}</span>
    </>
  );
}

const barItem = "no-callout group flex min-w-0 flex-1 flex-col items-center justify-center gap-1 pt-1.5 pb-1";
const railItem = "no-callout group flex w-full flex-col items-center gap-1 py-1.5";

/** Fixed bottom bar for phones (hidden from 600 px, where the rail takes over). */
export function NavBar({ children, label = "Main", className }) {
  return (
    <nav
      aria-label={label}
      className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] sm:hidden", className)}
    >
      <ul className="mx-auto flex h-[var(--kv-navbar-h)] max-w-lg items-stretch px-1">{children}</ul>
    </nav>
  );
}

/** `srHint` is read after the label (e.g. "3 unread"). `active` overrides the route match. */
export function NavBarLink({ to, end, icon, label, primary, dot, count, srHint, active }) {
  return (
    <li className="flex min-w-0 flex-1">
      <NavLink to={to} end={end} className={barItem}>
        {({ isActive }) => (
          <>
            <ItemBody icon={icon} label={label} active={active ?? isActive} primary={primary} dot={dot} count={count} />
            {srHint && <span className="sr-only">, {srHint}</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}

/** A bar item that opens something (e.g. the "More" sheet) instead of navigating. */
export function NavBarButton({ icon, label, active, dot, onClick, ...props }) {
  return (
    <li className="flex min-w-0 flex-1">
      <button type="button" onClick={onClick} className={barItem} {...props}>
        <ItemBody icon={icon} label={label} active={active} dot={dot} />
      </button>
    </li>
  );
}

export function RailLink({ to, end, icon, label, dot, count, srHint }) {
  return (
    <li className="w-full">
      <NavLink to={to} end={end} className={railItem}>
        {({ isActive }) => (
          <>
            <ItemBody icon={icon} label={label} active={isActive} dot={dot} count={count} />
            {srHint && <span className="sr-only">, {srHint}</span>}
          </>
        )}
      </NavLink>
    </li>
  );
}
