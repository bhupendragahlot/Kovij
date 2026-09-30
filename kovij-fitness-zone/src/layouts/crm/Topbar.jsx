import { useEffect } from "react";
import { useLocation, useMatches } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Check, LogOut, Monitor, Moon, Search, Sun, UserPlus } from "lucide-react";
import { ButtonLink, Menu } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { initials } from "../../shared/lib/format";
import { commandPaletteSet } from "../../app/uiSlice";
import { useThemeControls } from "../../app/theme";
import { selectStaffUser } from "../../features/auth/sessionSlice";
import { useLogout } from "../../features/auth/api";
import { ROLE_LABEL } from "../../shared/domain/status";
import { BrandMark } from "./BrandMark";

/** Keeps the browser tab / installed-app window title in step with the page. */
function useDocumentTitle() {
  const matches = useMatches();
  const title = [...matches].reverse().find((m) => m.handle?.title)?.handle.title;
  useEffect(() => {
    document.title = title ? `${title} | Kovij Desk` : "Kovij Desk";
  }, [title]);
}

function AccountMenu() {
  const user = useSelector(selectStaffUser);
  const logout = useLogout();
  const { preference, setTheme } = useThemeControls();
  const themeItem = (value, label, icon) => ({
    label,
    icon: preference === value ? Check : icon,
    onSelect: () => setTheme(value),
  });
  return (
    <Menu
      label="Account"
      trigger={(props) => (
        <button
          {...props}
          type="button"
          aria-label="Account and theme"
          className="grid size-10 place-items-center rounded-full bg-ink text-[13px] font-bold text-canvas hover:opacity-90"
        >
          {initials(user?.name || user?.username || "")}
        </button>
      )}
      items={[
        { type: "heading", label: user?.name || user?.username || "Signed in", hint: ROLE_LABEL[user?.role] },
        { type: "separator" },
        themeItem("light", "Light theme", Sun),
        themeItem("dark", "Dark theme", Moon),
        themeItem("system", "Match device", Monitor),
        { type: "separator" },
        { label: "Sign out", icon: LogOut, onSelect: logout, tone: "danger" },
      ]}
    />
  );
}

export function Topbar() {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  useDocumentTitle();
  const openSearch = () => dispatch(commandPaletteSet(true));
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");

  return (
    <header className="sticky top-0 z-30 border-b border-line/70 bg-canvas/85 backdrop-blur-md supports-[backdrop-filter]:bg-canvas/75">
      <div className="flex h-16 items-center gap-3 px-4 md:px-6 xl:px-8">
        {/* Phones: brand only. Each page already shows its title large, right below. */}
        <BrandMark tone="ink" className="flex-1 md:hidden" />

        <button
          type="button"
          onClick={openSearch}
          className={cn(
            "hidden h-10 w-full max-w-md items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 text-left text-sm text-ink-3",
            "transition-colors hover:border-ink-3 md:flex"
          )}
        >
          <Search className="size-4" aria-hidden />
          <span className="flex-1">Search members by name, phone or code</span>
          <kbd className="rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 font-ui text-[11px] font-semibold text-ink-3">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <div className="hidden flex-1 md:block" />

        <button
          type="button"
          onClick={openSearch}
          aria-label="Search members"
          className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface md:hidden"
        >
          <Search className="size-5" aria-hidden />
        </button>
        {pathname !== "/admin/members/new" && (
          <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus} className="max-md:hidden">
            New member
          </ButtonLink>
        )}
        <AccountMenu />
      </div>
    </header>
  );
}
