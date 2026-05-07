import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useMemberAuth } from "../../context/MemberAuthContext";
import MemberSidebar from "../../components/member/MemberSidebar";
import MemberBottomNav from "../../components/member/MemberBottomNav";

export default function MemberLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const { member } = useMemberAuth();

  // If not logged in, render member pages without dashboard chrome.
  if (!member) {
    return (
      <div
        className={`min-h-screen ${
          theme === "dark" ? "bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white" : "bg-gray-50 text-gray-900"
        }`}
      >
        <main className="px-4 py-6 sm:px-6">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <div
      className={`min-h-screen ${
        theme === "dark"
          ? "bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950 text-white"
          : "bg-[#F6F2ED] text-gray-900"
      }`}
    >
      <MemberSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      <div className="md:ml-64 min-h-screen">
        <header
          className={`${
            theme === "dark" ? "bg-gray-950/60 border-gray-800" : "bg-[#F6F2ED]/70 border-black/10"
          } border-b px-3 sm:px-6 py-2 sm:py-3 flex items-center justify-between backdrop-blur`}
        >
          <div className="flex items-center space-x-4">
            <div className="md:hidden w-9"></div>
            <div>
              <div className={`text-[11px] ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Kovij Fitness</div>
              <h1
                className={`text-base sm:text-lg font-semibold ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                <span className="hidden sm:inline">Member dashboard</span>
                <span className="sm:hidden">Member</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleTheme}
              className={`p-2 sm:p-2 rounded-lg transition-colors duration-200 ${
                theme === "dark"
                  ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                  : "bg-white/80 text-gray-800 hover:bg-white"
              }`}
              type="button"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 sm:w-8 sm:h-8 rounded-full ${
                  theme === "dark" ? "bg-red-600" : "bg-red-500"
                } flex items-center justify-center`}
              >
                <span className="text-white text-sm font-medium">{(member?.name || "M").slice(0, 1).toUpperCase()}</span>
              </div>
              <span className={`hidden sm:block font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                {member?.name || "Member"}
              </span>
            </div>
          </div>
        </header>

        <main className="px-4 py-5 sm:px-6 pb-24 md:pb-6">
          <Outlet />
        </main>
      </div>

      <MemberBottomNav />
    </div>
  );
}

