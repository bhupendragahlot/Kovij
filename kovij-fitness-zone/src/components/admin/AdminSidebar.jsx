
import { useLocation, useNavigate } from "react-router-dom"
import { Home, Users, Calendar, ShoppingBag, LogOut, Menu, X, Settings,  Dumbbell,BarChart3 } from "lucide-react"
import { useTheme } from '../../context/ThemeContext';

const AdminSidebar = ({ sidebarOpen, setSidebarOpen }) => {
  const { theme } = useTheme()
  const location = useLocation()
  const navigate = useNavigate()

  const menuItems = [
    {
      name: "Dashboard",
      path: "/admin/dashboard",
      icon: Home,
    },
    {
      name: "Trainers",
      path: "/admin/trainers",
      icon: Users,
    },
    {
      name: "Plans",
      path: "/admin/plans",
      icon: Calendar,
    },
    {
      name: "Products",
      path: "/admin/products",
      icon: ShoppingBag,
    },
    {
      name: "Analytics",
      path: "/admin/analytics",
      icon: BarChart3,
    },
    {
      name: "Settings",
      path: "/admin/settings",
      icon: Settings,
    },
  ]

  const handleLogout = () => {
    localStorage.removeItem("authToken")
    navigate("/admin/login")
  }

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + "/")
  }

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={`md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg ${
          theme === "dark" ? "bg-gray-700 text-white hover:bg-gray-600" : "bg-white text-gray-800 hover:bg-gray-100"
        } shadow-lg transition-colors duration-200`}
      >
        {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed inset-y-0 left-0 w-64 ${
          theme === "dark" ? "bg-gray-900 border-gray-700" : "bg-white border-gray-200"
        } border-r shadow-xl transform transition-transform duration-300 ease-in-out z-40 flex flex-col`}
      >
        {/* Header */}
        <div className={`p-6 border-b ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <div className="flex items-center space-x-3">
            <div
              className={`w-10 h-10 rounded-lg ${
                theme === "dark" ? "bg-blue-600" : "bg-blue-500"
              } flex items-center justify-center`}
            >
              < Dumbbell className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Kovij</h2>
              <p className={`text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>Management Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-2">
          {menuItems.map((item) => {
            const Icon = item.icon
            const active = isActive(item.path)

            return (
              <button
                key={item.name}
                onClick={() => {
                  navigate(item.path)
                  setSidebarOpen(false) // Close sidebar on mobile after navigation
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
                  active
                    ? theme === "dark"
                      ? "bg-blue-600 text-white shadow-lg"
                      : "bg-blue-500 text-white shadow-lg"
                    : theme === "dark"
                      ? "text-gray-300 hover:bg-gray-800 hover:text-white"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon size={20} />
                <span className="font-medium">{item.name}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className={`p-4 border-t ${theme === "dark" ? "border-gray-700" : "border-gray-200"}`}>
          <button
            onClick={handleLogout}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all duration-200 ${
              theme === "dark"
                ? "text-red-400 hover:bg-red-900/20 hover:text-red-300"
                : "text-red-600 hover:bg-red-50 hover:text-red-700"
            }`}
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>

      {/* Mobile Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30 transition-opacity duration-300"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </>
  )
}

export default AdminSidebar
