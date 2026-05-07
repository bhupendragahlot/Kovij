import { useLocation, useNavigate } from "react-router-dom";
import { Home, UserCircle, Calendar, User } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";

const tabs = [
  { label: "Home", path: "/member/dashboard", icon: Home },
  { label: "Profile", path: "/member/profile", icon: UserCircle },
  { label: "Plan", path: "/member/membership", icon: Calendar },
  { label: "My Account", path: "/member/account", icon: User },
];

export default function MemberBottomNav() {
  const { theme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    location.pathname === path || location.pathname.startsWith(path + "/");

  return (
    <nav
      className={`md:hidden fixed inset-x-0 bottom-0 z-40 border-t ${
        theme === "dark"
          ? "border-gray-800 bg-gray-950/95"
          : "border-gray-200 bg-white/95"
      } backdrop-blur`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Member navigation"
    >
      <div className="grid grid-cols-4">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = isActive(t.path);
          return (
            <button
              key={t.path}
              type="button"
              onClick={() => navigate(t.path)}
              className={`flex flex-col items-center justify-center gap-1 px-2 py-2 text-xs ${
                active
                  ? theme === "dark"
                    ? "text-red-300"
                    : "text-red-600"
                  : theme === "dark"
                    ? "text-gray-400"
                    : "text-gray-500"
              }`}
            >
              <div
                className={`rounded-xl px-3 py-1 ${
                  active
                    ? theme === "dark"
                      ? "bg-red-600/15"
                      : "bg-red-50"
                    : "bg-transparent"
                }`}
              >
                <Icon size={20} />
              </div>
              <span className="leading-none">{t.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}

