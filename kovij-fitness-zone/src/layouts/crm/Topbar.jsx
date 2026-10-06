import { useEffect } from "react";
import { useLocation, useMatches, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Check, Download, LogOut, Monitor, Moon, Search, Sun, UserCog, UserPlus } from "lucide-react";
import { ButtonLink, IosInstallDialog, Menu } from "../../shared/ui";
import { useInstallAction } from "../../shared/hooks/useInstallAction";
import { cn } from "../../shared/lib/cn";
import { useScrolled } from "../../shared/hooks/useScrolled";
import { initials } from "../../shared/lib/format";
import { commandPaletteSet } from "../../app/uiSlice";
import { useThemeControls } from "../../app/theme";
import { selectStaffUser } from "../../features/auth/sessionSlice";
import { useLogout } from "../../features/auth/api";
import { usePermission } from "../../features/auth/permissions";
import { useSettings } from "../../features/settings/api";
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
  const navigate = useNavigate();
  const { preference, setTheme } = useThemeControls();
  // "Install desk app" while it isn't installed on this device (iPhone: Add to Home Screen steps).
  const install = useInstallAction();
  const themeItem = (value, label, icon) => ({
    label,
    icon: preference === value ? Check : icon,
    onSelect: () => setTheme(value),
  });
  return (
    <>
      <Menu
        label="Account"
        trigger={(props) => (
          <button
            {...props}
            type="button"
            aria-label="Account and theme"
            className="state-layer touch-target grid size-9 place-items-center rounded-full bg-ink text-label font-bold text-canvas"
          >
            {initials(user?.name || user?.username || "")}
          </button>
        )}
        items={[
          { type: "heading", label: user?.name || user?.username || "Signed in", hint: ROLE_LABEL[user?.role] },
          { type: "separator" },
          { label: "My account", icon: UserCog, onSelect: () => navigate("/admin/settings?tab=account") },
          install && { label: "Install desk app", icon: Download, onSelect: install.install },
          { type: "separator" },
          themeItem("light", "Light theme", Sun),
          themeItem("dark", "Dark theme", Moon),
          themeItem("system", "Match device", Monitor),
          { type: "separator" },
          { label: "Sign out", icon: LogOut, onSelect: logout, tone: "danger" },
        ].filter(Boolean)}
      />
      {install && <IosInstallDialog open={install.stepsOpen} onClose={install.closeSteps} appName="Kovij Desk" />}
    </>
  );
}

export function Topbar() {
  const dispatch = useDispatch();
  const { pathname } = useLocation();
  const canAddMember = usePermission("members.edit");
  const logoUrl = useSettings().data?.logoUrl;
  useDocumentTitle();
  const openSearch = () => dispatch(commandPaletteSet(true));
  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform || "");
  const scrolled = useScrolled();

  return (
    // Top app bar: 56 px on phones, 64 px from 840 px; flat at rest, tinted with a hairline once content scrolls under it.
    <header
      className={cn(
        "sticky top-0 z-30 border-b pt-[env(safe-area-inset-top)] transition-colors duration-200",
        scrolled ? "border-line bg-surface/95 backdrop-blur-md" : "border-transparent bg-canvas"
      )}
    >
      <div className="flex h-14 items-center gap-2 px-4 sm:gap-3 sm:px-6 md:h-16 xl:px-8">
        {/* Phones: brand only. Each page shows its title right below. */}
        <BrandMark tone="ink" logoUrl={logoUrl} className="flex-1 sm:hidden" />

        <button
          type="button"
          onClick={openSearch}
          className={cn(
            "hidden h-10 w-full max-w-md min-w-0 items-center gap-2.5 rounded-full border border-line-strong bg-surface px-4 text-left text-sm text-ink-3",
            "transition-colors hover:border-ink-3 sm:flex"
          )}
        >
          <Search className="size-[18px] shrink-0" aria-hidden />
          <span className="flex-1 truncate">Search members by name, phone or code</span>
          <kbd className="hidden rounded-[6px] border border-line bg-surface-2 px-1.5 py-0.5 font-ui text-label-sm font-semibold text-ink-3 md:inline">
            {isMac ? "⌘" : "Ctrl"} K
          </kbd>
        </button>
        <div className="hidden flex-1 sm:block" />

        <button
          type="button"
          onClick={openSearch}
          aria-label="Search members"
          className="state-layer touch-target grid size-10 place-items-center rounded-full text-ink-2 sm:hidden"
        >
          <Search className="size-6" aria-hidden />
        </button>
        {canAddMember && pathname !== "/admin/members/new" && (
          <ButtonLink to="/admin/members/new" variant="primary" icon={UserPlus} className="max-sm:hidden">
            New member
          </ButtonLink>
        )}
        <AccountMenu />
      </div>
    </header>
  );
}
