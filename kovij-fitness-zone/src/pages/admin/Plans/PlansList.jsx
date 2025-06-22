"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { Plus, Search, Edit, Trash2, Eye, Calendar, Star, EyeOff } from "lucide-react"

const API_URL = "https://kovij.onrender.com/api/plans"

const PlansList = () => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(false)

  // Fetch plans from API
  useEffect(() => {
    setLoading(true)
    fetch(API_URL)
      .then((res) => res.json())
      .then((data) => setPlans(data))
      .finally(() => setLoading(false))
  }, [])

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this plan?")) {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" })
      setPlans((plans) => plans.filter((plan) => plan._id !== id))
    }
  }

  const filteredPlans = plans.filter(
    (plan) =>
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (plan.features && plan.features.join(", ").toLowerCase().includes(searchTerm.toLowerCase())) ||
      (plan.status && plan.status.toLowerCase().includes(searchTerm.toLowerCase())),
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Fitness Plans</h1>
          <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Manage your fitness plans and training programs
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/plans/new")}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus size={20} className="mr-2" />
          Add New Plan
        </button>
      </div>

      {/* Search */}
      <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-4`}>
        <div className="relative">
          <Search
            className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}
            size={20}
          />
          <input
            type="text"
            placeholder="Search plans..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className={`w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
              theme === "dark"
                ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
            }`}
          />
        </div>
      </div>

      {/* Plans Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading...</div>
        ) : filteredPlans.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            <p>No plans found matching your search criteria.</p>
          </div>
        ) : (
          filteredPlans.map((plan) => (
            <div
              key={plan._id}
              className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-6 flex flex-col justify-between hover:shadow-lg transition-shadow duration-200`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-12 h-12 rounded-lg flex items-center justify-center"
                    style={{
                      background: `linear-gradient(to right, ${
                        plan.color?.replace("from-", "").replace("to-", "") || "#3b82f6"
                      }, #f59e42)`,
                    }}
                  >
                    <Calendar className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                      {plan.name}
                    </h3>
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        plan.status === "Active" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}
                    >
                      {plan.status}
                    </span>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  {plan.popular && <Star className="text-yellow-400" size={18} title="Popular" />}
                  {!plan.showOnFrontend && <EyeOff className="text-gray-400" size={18} title="Hidden from frontend" />}
                </div>
              </div>
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-400">Duration:</span>
                <span className="ml-2 text-sm">{plan.duration}</span>
              </div>
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-400">Price:</span>
                <span className="ml-2 text-sm">₹{plan.price}</span>
              </div>
              <div className="mb-2">
                <span className="text-xs font-medium text-gray-400">Features:</span>
                <span className="ml-2 text-sm">{plan.features?.join(", ")}</span>
              </div>
              <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700 mt-auto">
                <span className={`text-xs ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
                  Created: {new Date(plan.createdAt).toLocaleDateString()}
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => navigate(`/admin/plans/view/${plan._id}`)}
                    className={`p-2 rounded-lg transition-colors duration-200 ${
                      theme === "dark" ? "text-blue-400 hover:bg-blue-900/20" : "text-blue-600 hover:bg-blue-50"
                    }`}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    onClick={() => navigate(`/admin/plans/edit/${plan._id}`)}
                    className={`p-2 rounded-lg transition-colors duration-200 ${
                      theme === "dark" ? "text-yellow-400 hover:bg-yellow-900/20" : "text-yellow-600 hover:bg-yellow-50"
                    }`}
                  >
                    <Edit size={16} />
                  </button>
                  <button
                    onClick={() => handleDelete(plan._id)}
                    className={`p-2 rounded-lg transition-colors duration-200 ${
                      theme === "dark" ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default PlansList
