import { useTheme } from "../../context/ThemeContext"
import { Users, Calendar, ShoppingBag, TrendingUp } from "lucide-react"
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import axios from "axios";

const API_URL = "/api";

const DashboardHome = () => {
  const { theme } = useTheme();
  const navigate = useNavigate();

  const [plansCount, setPlansCount] = useState(0);
  const [trainersCount, setTrainersCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);

  useEffect(() => {
    axios.get(`${API_URL}/plans`).then((res) => {
      setPlansCount(res.data.length);
    });
    axios.get(`${API_URL}/trainers`).then((res) => {
      setTrainersCount(res.data.length);
    });
    axios.get(`${API_URL}/products`).then((res) => {
      setProductsCount(res.data.length);
    });
  }, []);

  const stats = [
    {
      name: "Total Trainers",
      value: trainersCount.toString(),
      icon: Users,
    },
    {
      name: "Plans",
      value: plansCount.toString(),
      icon: Calendar,
    },
    {
      name: "Products",
      value: productsCount.toString(),
      icon: ShoppingBag,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h2 className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Welcome back!</h2>
        <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
          Here's what's happening with your fitness center today.
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
                <span className="text-green-500 text-sm font-medium">{stat.change}</span>
                {/* <span className={`ml-2 text-sm ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
                  from last month
                </span> */}
              </div>
            </div>
          )
        })}
      </div>

      {/* Quick Actions */}
      <div
        className={`${
          theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"
        } border rounded-lg p-6 shadow-sm`}
      >
        <h3 className={`text-lg font-semibold mb-4 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
          onClick={() => navigate("/admin/trainers/new")}
            className={`p-4 rounded-lg border-2 border-dashed transition-colors duration-200 ${
              theme === "dark"
                ? "border-gray-600 hover:border-blue-500 hover:bg-blue-900/10"
                : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <Users className={`w-8 h-8 mx-auto mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
            <p className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Add New Trainer</p>
          </button>
          <button
           onClick={() => navigate("/admin/plans/new")}
            className={`p-4 rounded-lg border-2 border-dashed transition-colors duration-200 ${
              theme === "dark"
                ? "border-gray-600 hover:border-blue-500 hover:bg-blue-900/10"
                : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <Calendar className={`w-8 h-8 mx-auto mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
            <p className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Create New Plan</p>
          </button>
          <button
              onClick={() => navigate("/admin/products/new")}
            className={`p-4 rounded-lg border-2 border-dashed transition-colors duration-200 ${
              theme === "dark"
                ? "border-gray-600 hover:border-blue-500 hover:bg-blue-900/10"
                : "border-gray-300 hover:border-blue-500 hover:bg-blue-50"
            }`}
          >
            <ShoppingBag className={`w-8 h-8 mx-auto mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`} />
            <p className={`font-medium ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Add Product</p>
          </button>
        </div>
      </div>
    </div>
  )
}

export default DashboardHome
