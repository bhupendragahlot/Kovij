import { useState, useEffect, useRef } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { ArrowLeft, Save, Star, Eye, EyeOff } from "lucide-react"
import axios from "axios"

const API_URL = "/api/plans"
const DURATION_OPTIONS = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
]
const COLOR_OPTIONS = [
  { value: "from-gray-300 to-gray-100", label: "Silver", preview: "bg-gradient-to-r from-gray-300 to-gray-100" },
  { value: "from-yellow-400 to-yellow-200", label: "Gold", preview: "bg-gradient-to-r from-yellow-400 to-yellow-200" },
  { value: "from-zinc-300 to-zinc-100", label: "Platinum", preview: "bg-gradient-to-r from-zinc-300 to-zinc-100" },
  { value: "from-cyan-300 to-blue-200", label: "Diamond", preview: "bg-gradient-to-r from-cyan-300 to-blue-200" }, 
  // Festival-themed colors
  { value: "from-orange-600 to-yellow-400", label: "Diwali Glow", preview: "bg-gradient-to-r from-orange-600 to-yellow-400" },
  { value: "from-red-700 to-green-500", label: "Christmas Joy", preview: "bg-gradient-to-r from-red-700 to-green-500" },
  { value: "from-pink-500 via-yellow-400 to-green-400", label: "Holi Splash", preview: "bg-gradient-to-r from-pink-500 via-yellow-400 to-green-400" },
  { value: "from-emerald-600 to-amber-300", label: "Eid Elegance", preview: "bg-gradient-to-r from-emerald-600 to-amber-300" },
  { value: "from-purple-800 to-orange-600", label: "Halloween Vibe", preview: "bg-gradient-to-r from-purple-800 to-orange-600" },
  { value: "from-indigo-600 to-pink-500", label: "New Year Pop", preview: "bg-gradient-to-r from-indigo-600 to-pink-500" },
  { value: "from-red-400 to-yellow-300", label: "Raksha Bandhan", preview: "bg-gradient-to-r from-red-400 to-yellow-300" },
  { value: "from-teal-400 to-blue-300", label: "Onam Spirit", preview: "bg-gradient-to-r from-teal-400 to-blue-300" },
  { value: "from-lime-500 to-amber-300", label: "Harvest Fest", preview: "bg-gradient-to-r from-lime-500 to-amber-300" },
];

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
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false)
  const colorDropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target)) {
        setColorDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Fetch plan if editing
  useEffect(() => {
    if (isEditing) {
      setLoading(true)
      axios
        .get(`${API_URL}/${id}`)
        .then((res) => {
          const data = res.data; // <-- Fix here
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
      const token = localStorage.getItem("token");
      const url = isEditing ? `${API_URL}/${id}` : API_URL
      const method = isEditing ? "put" : "post"
      await axios[method](url, formData, {
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      })
      navigate("/admin/plans")
    } catch (error) {
      alert(error.response?.data?.message || error.message)
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
              <div className="relative" ref={colorDropdownRef}>
                <button
                  type="button"
                  className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                    theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"
                  }`}
                  onClick={() => setColorDropdownOpen((open) => !open)}
                >
                  <span className="flex-1 text-left">
                    {COLOR_OPTIONS.find(opt => opt.value === formData.color)?.label || "Select color"}
                  </span>
                  <span className={`w-12 h-5 rounded ${COLOR_OPTIONS.find(opt => opt.value === formData.color)?.preview || ""} border border-gray-300 ml-2`} />
                  <svg className="ml-2 w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {colorDropdownOpen && (
                  <div className={`absolute z-10 mt-1 w-full rounded-lg shadow-lg max-h-60 overflow-auto border
                    ${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"}
                  `}>
                    {COLOR_OPTIONS.map((opt) => (
                      <div
                        key={opt.value}
                        className={`flex items-center px-3 py-2 cursor-pointer ${
                          formData.color === opt.value
                            ? (theme === "dark" ? "bg-blue-900" : "bg-blue-100")
                            : (theme === "dark" ? "hover:bg-gray-700" : "hover:bg-gray-100")
                        }`}
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, color: opt.value }))
                          setColorDropdownOpen(false)
                        }}
                      >
                        <span className="text-sm flex-1">{opt.label}</span>
                        <span className={`w-12 h-5 rounded ${opt.preview} border border-gray-300 ml-2`} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Color preview */}
              <div className="mt-2 flex items-center">
                <span
                  className={`w-12 h-5 rounded ${COLOR_OPTIONS.find(opt => opt.value === formData.color)?.preview || ""} border border-gray-300 inline-block`}
                />
                <span className="ml-2 text-xs text-gray-500">{COLOR_OPTIONS.find(opt => opt.value === formData.color)?.label}</span>
              </div>
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
