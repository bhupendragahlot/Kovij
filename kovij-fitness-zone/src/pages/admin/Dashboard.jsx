"use client"

import { useState } from "react"
import { Outlet } from "react-router-dom"
import AdminSidebar from "../../components/admin/AdminSidebar"
import { useTheme } from "../../context/ThemeContext"
import { Sun, Moon } from "lucide-react"

const AdminDashboard = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { theme, toggleTheme } = useTheme()

  return (
    <div className={`min-h-screen ${theme === "dark" ? "bg-gray-900 text-white" : "bg-gray-50 text-gray-900"}`}>
      <AdminSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

      {/* Main Content */}
      <div className="md:ml-64 min-h-screen">
        {/* Top Bar */}
        <header
          className={`${
            theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
          } border-b px-6 py-4 flex items-center justify-between`}
        >
          <div className="flex items-center space-x-4">
            <div className="md:hidden w-10"></div> {/* Spacer for mobile menu button */}
            <h1 className={`text-2xl font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
             kovij
            </h1>
          </div>

          <div className="flex items-center space-x-4">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className={`p-2 rounded-lg transition-colors duration-200 ${
                theme === "dark"
                  ? "bg-gray-700 text-yellow-400 hover:bg-gray-600"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}
            </button>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              <div
                className={`w-8 h-8 rounded-full ${
                  theme === "dark" ? "bg-blue-600" : "bg-blue-500"
                } flex items-center justify-center`}
              >
                <span className="text-white text-sm font-medium">A</span>
              </div>
              <span className={`hidden sm:block font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                Admin User
              </span>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
