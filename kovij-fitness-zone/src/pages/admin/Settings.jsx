import { useState, useEffect } from "react"
import { useTheme } from "../../context/ThemeContext"
import { Save, Pencil } from "lucide-react"
import axios from "axios"

const AdminSettings = () => {
  const { theme } = useTheme()
  const [loading, setLoading] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [settings, setSettings] = useState({
    heroBackgroundImage: "",
    heroHeadline: "",
    heroDescription: "",
    address: "",
    phone: "",
    email: "",
    facebook: "",
    instagram: "",
    whatsapp: "",
    mapEmbedUrl: ""
  })

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      setLoading(true)
      try {
        const res = await axios.get(`/api/settings`)
        setSettings(res.data)
      } catch (error) {
        // Handle error if needed
      } finally {
        setLoading(false)
      }
    }
    fetchSettings()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  // Save settings (POST or PUT)
  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `/api/settings`,
        settings,
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      )
      setEditMode(false)
      // Optionally show a success message
    } catch (error) {
      // Handle error
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-2 py-4">
      <div className="flex items-center justify-between mb-4">
        <h1 className={`text-2xl md:text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Website Settings</h1>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            <Pencil size={16} className="mr-2" />
            Edit
          </button>
        )}
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-4 md:p-6`}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Hero Background Image URL</label>
              <input
                type="text"
                name="heroBackgroundImage"
                value={settings.heroBackgroundImage}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Hero Headline</label>
              <input
                type="text"
                name="heroHeadline"
                value={settings.heroHeadline}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Hero Description</label>
              <textarea
                name="heroDescription"
                value={settings.heroDescription}
                onChange={handleChange}
                rows={2}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Address</label>
              <textarea
                type="text"
                name="address"
                value={settings.address}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phone</label>
              <input
                type="text"
                name="phone"
                value={settings.phone}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Email</label>
              <input
                type="email"
                name="email"
                value={settings.email}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Facebook</label>
              <input
                type="text"
                name="facebook"
                value={settings.facebook}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Instagram</label>
              <input
                type="text"
                name="instagram"
                value={settings.instagram}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">WhatsApp</label>
              <input
                type="text"
                name="whatsapp"
                value={settings.whatsapp}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium mb-1">Google Map Embed URL</label>
              <input
                type="text"
                name="mapEmbedUrl"
                value={settings.mapEmbedUrl}
                onChange={handleChange}
                disabled={!editMode}
                className={`w-full px-3 py-2 border rounded-lg text-sm ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"} ${!editMode ? "opacity-60 cursor-not-allowed" : ""}`}
              />
            </div>
          </div>
        </div>
        {editMode && (
          <div className="flex items-center justify-end mt-4">
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
                  Save Settings
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => setEditMode(false)}
              className="ml-3 px-4 py-2 rounded-lg border border-gray-300 bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors duration-200"
            >
              Cancel
            </button>
          </div>
        )}
      </form>
    </div>
  )
}

export default AdminSettings
