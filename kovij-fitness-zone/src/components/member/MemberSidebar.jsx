import { useLocation, useNavigate } from "react-router-dom";
import { Home, UserCircle, Calendar, Receipt, LogOut, Menu, X, Dumbbell, User } from "lucide-react";
import { useTheme } from "../../context/ThemeContext";
import { useMemberAuth } from "../../context/MemberAuthContext";

export default function MemberSidebar({ sidebarOpen, setSidebarOpen }) {
  const { theme } = useTheme();
  const { logout } = useMemberAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    { name: "Dashboard", path: "/member/dashboard", icon: Home },
    { name: "My account", path: "/member/account", icon: User },
    { name: "My profile", path: "/member/profile", icon: UserCircle },
    { name: "Membership", path: "/member/membership", icon: Calendar },
    { name: "Payments", path: "/member/payments", icon: Receipt },
  ];

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <>
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`md:hidden fixed top-3 left-3 z-50 h-10 w-10 grid place-items-center rounded-2xl ${
          theme === "dark"
            ? "bg-gray-950/70 text-white hover:bg-gray-900"
            : "bg-white/80 text-gray-900 hover:bg-white"
        } border ${
          theme === "dark" ? "border-gray-800" : "border-gray-200"
        } shadow-lg backdrop-blur transition-colors duration-200`}
        aria-label={sidebarOpen ? "Close menu" : "Open menu"}
        type="button"
      >
        {sidebarOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed inset-y-0 left-0 w-64 ${
          theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
        } border-r shadow-xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col`}
      >
        <div className={`p-6 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-lg ${
                theme === "dark" ? "bg-red-600" : "bg-red-500"
              } flex items-center justify-center`}
            >
              <Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Kovij</h2>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Member Dashboard</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  active
                    ? theme === "dark"
                      ? "bg-red-600 text-white shadow-lg"
                      : "bg-red-500 text-white shadow-lg"
                    : theme === "dark"
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
                type="button"
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </button>
            );
          })}
        </nav>

        <div className={`p-4 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <button
            onClick={() => logout()}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              theme === "dark"
                ? "text-red-400 hover:bg-red-900/20 hover:text-red-300"
                : "text-red-600 hover:bg-red-50 hover:text-red-700"
            }`}
            type="button"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  );
}

