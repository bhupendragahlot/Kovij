"use client"

import { useTheme } from "../../context/ThemeContext"
import { TrendingUp, Users, Calendar, ShoppingBag, DollarSign } from "lucide-react"

const AdminAnalytics = () => {
  const { theme } = useTheme()

  const stats = [
    {
      name: "Total Revenue",
      value: "$45,231",
      change: "+20.1%",
      changeType: "positive",
      icon: DollarSign,
    },
    {
      name: "Active Members",
      value: "2,345",
      change: "+15.3%",
      changeType: "positive",
      icon: Users,
    },
    {
      name: "Plans Sold",
      value: "156",
      change: "+8.2%",
      changeType: "positive",
      icon: Calendar,
    },
    {
      name: "Products Sold",
      value: "89",
      change: "-2.4%",
      changeType: "negative",
      icon: ShoppingBag,
    },
  ]

  const recentActivity = [
    { id: 1, action: "New member registration", user: "John Doe", time: "2 minutes ago" },
    { id: 2, action: "Plan purchase", user: "Sarah Smith", time: "15 minutes ago" },
    { id: 3, action: "Product order", user: "Mike Johnson", time: "1 hour ago" },
    { id: 4, action: "Trainer session booked", user: "Emily Davis", time: "2 hours ago" },
    { id: 5, action: "Plan renewal", user: "David Wilson", time: "3 hours ago" },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          Analytics Dashboard
        </h1>
        <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Track your fitness center's performance and growth
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon
          return (
            <div
              key={stat.name}
              className={`${
                theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
              } border rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow duration-200`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-sm font-medium ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                    {stat.name}
                  </p>
                  <p className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {stat.value}
                  </p>
                </div>
                <div className={`p-3 rounded-full ${theme === "dark" ? "bg-blue-900/20" : "bg-blue-50"}`}>
                  <Icon className={`w-6 h-6 ${theme === "dark" ? "text-blue-400" : "text-blue-600"}`} />
                </div>
              </div>
              <div className="mt-4 flex items-center">
                <span
                  className={`text-sm font-medium ${
                    stat.changeType === "positive" ? "text-green-500" : "text-red-500"
                  }`}
                >
                  {stat.change}
                </span>
                <span className={`ml-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  from last month
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div
          className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-6`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Revenue Trend
          </h3>
          <div className="h-64 flex items-center justify-center">
            <div className={`text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              <TrendingUp size={48} className="mx-auto mb-4 opacity-50" />
              <p>Chart visualization would go here</p>
              <p className="text-sm">Integration with charting library needed</p>
            </div>
          </div>
        </div>

        {/* Member Growth Chart */}
        <div
          className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-6`}
        >
          <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Member Growth
          </h3>
          <div className="h-64 flex items-center justify-center">
            <div className={`text-center ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
              <Users size={48} className="mx-auto mb-4 opacity-50" />
              <p>Chart visualization would go here</p>
              <p className="text-sm">Integration with charting library needed</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-6`}
      >
        <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          Recent Activity
        </h3>
        <div className="space-y-4">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="flex items-center space-x-4">
              <div className={`w-2 h-2 rounded-full ${theme === "dark" ? "bg-blue-400" : "bg-blue-500"}`}></div>
              <div className="flex-1">
                <p className={`text-sm ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  <span className="font-medium">{activity.user}</span> - {activity.action}
                </p>
                <p className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>{activity.time}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default AdminAnalytics
