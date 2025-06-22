import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { ArrowLeft, Save, Star, Eye, EyeOff } from "lucide-react"

const API_URL = "/api/plans"
const DURATION_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
]
const COLOR_OPTIONS = [
  { value: "from-gray-600 to-gray-700", label: "Gray" },
  { value: "from-red-600 to-red-500", label: "Red" },
  { value: "from-yellow-600 to-yellow-500", label: "Yellow" },
  { value: "from-blue-600 to-blue-500", label: "Blue" },
  { value: "from-green-600 to-green-500", label: "Green" },
]

const PlanForm = () => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState({
    name: "",
    price: "",
    duration: "month",
    features: [],
    popular: false,
    color: "from-gray-600 to-gray-700",
    status: "Active",
    showOnFrontend: true,
  })
  const [featureInput, setFeatureInput] = useState("")
  const [loading, setLoading] = useState(false)

  // Fetch plan if editing
  useEffect(() => {
    if (isEditing) {
      setLoading(true)
      fetch(`${API_URL}/${id}`, {
          headers: { Authorization: `Bearer ${token}` }
        }
      )
        .then((res) => res.json())
        .then((data) => {
          setFormData({
            name: data.name || "",
            price: data.price || "",
            duration: data.duration || "month",
            features: data.features || [],
            popular: data.popular || false,
            color: data.color || "from-gray-600 to-gray-700",
            status: data.status || "Active",
            showOnFrontend: data.showOnFrontend !== undefined ? data.showOnFrontend : true,
          })
        })
        .finally(() => setLoading(false))
    }
  }, [isEditing, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const method = isEditing ? "PUT" : "POST"
      const url = isEditing ? `${API_URL}/${id}` : API_URL
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        Authorization: `Bearer ${token}`,
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error("Failed to save plan")
      navigate("/admin/plans")
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  // Features tag input logic
  const handleFeatureAdd = (e) => {
    e.preventDefault()
    if (featureInput.trim() && !formData.features.includes(featureInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        features: [...prev.features, featureInput.trim()],
      }))
      setFeatureInput("")
    }
  }
  const handleFeatureRemove = (feature) => {
    setFormData((prev) => ({
      ...prev,
      features: prev.features.filter((f) => f !== feature),
    }))
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/admin/plans")}
          className={`p-2 rounded-lg transition-colors duration-200 ${
            theme === "dark"
              ? "text-gray-400 hover:bg-gray-700 hover:text-white"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }`}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            {isEditing ? "Edit Plan" : "Add New Plan"}
          </h1>
          <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {isEditing ? "Update plan information" : "Create a new fitness plan"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-6`}>
          <h2 className={`text-lg font-semibold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Plan Details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Plan Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
                placeholder="Enter plan name"
              />
            </div>
            {/* Price */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Price (₹) *</label>
              <input
                type="number"
                name="price"
                value={formData.price}
                onChange={handleChange}
                required
                min="0"
                step="0.01"
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
                placeholder="Enter price"
              />
            </div>
            {/* Duration */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Duration *</label>
              <select
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                required
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                {DURATION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Color */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Color</label>
              <select
                name="color"
                value={formData.color}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                {COLOR_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            {/* Status */}
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Status</label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                }`}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            {/* Popular Toggle */}
            <div className="flex items-center space-x-2 mt-7">
              <input
                type="checkbox"
                name="popular"
                checked={formData.popular}
                onChange={handleChange}
                id="popular"
                className="form-checkbox h-5 w-5 text-yellow-500"
              />
              <label
                htmlFor="popular"
                className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
              >
                <Star className="inline-block mr-1 text-yellow-400" size={16} /> Popular Plan
              </label>
            </div>
            {/* Show on Frontend Toggle */}
            <div className="flex items-center space-x-2 mt-7">
              <input
                type="checkbox"
                name="showOnFrontend"
                checked={formData.showOnFrontend}
                onChange={handleChange}
                id="showOnFrontend"
                className="form-checkbox h-5 w-5 text-blue-500"
              />
              <label
                htmlFor="showOnFrontend"
                className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
              >
                {formData.showOnFrontend ? (
                  <Eye className="inline-block mr-1" size={16} />
                ) : (
                  <EyeOff className="inline-block mr-1" size={16} />
                )}
                Show on Frontend
              </label>
            </div>
          </div>
          {/* Features Tag Input */}
          <div className="mt-6">
            <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Features</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.features.map((feature, idx) => (
                <span key={idx} className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full flex items-center text-xs">
                  {feature}
                  <button
                    type="button"
                    className="ml-2 text-red-500 hover:text-red-700"
                    onClick={() => handleFeatureRemove(feature)}
                  >
                    &times;
                  </button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={featureInput}
                onChange={(e) => setFeatureInput(e.target.value)}
                className={`flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                  theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"
                }`}
                placeholder="Add a feature and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleFeatureAdd(e)
                }}
              />
              <button
                type="button"
                onClick={handleFeatureAdd}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Add
              </button>
            </div>
          </div>
        </div>
        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate("/admin/plans")}
            className={`px-6 py-2 border rounded-lg transition-colors duration-200 ${
              theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"
            }`}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving...
              </>
            ) : (
              <>
                <Save size={16} className="mr-2" />
                {isEditing ? "Update Plan" : "Create Plan"}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default PlanForm
