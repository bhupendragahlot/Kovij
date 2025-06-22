"use client"

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { ArrowLeft, Save } from "lucide-react"


const TrainerForm = () => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState({
    name: "",
    role: "",
    image: "",
    instagram: "",
    description: "",
    showOnFrontend: true,
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEditing) {
      setLoading(true)
      fetch(`/api/trainers/${id}`,{
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
        .then(res => res.json())
        .then(data => setFormData({
          name: data.name || "",
          role: data.role || "",
          image: data.image || "",
          instagram: data.instagram || "",
          description: data.description || "",
          showOnFrontend: data.showOnFrontend ?? true,
        }))
        .finally(() => setLoading(false))
    }
  }, [isEditing, id])

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const method = isEditing ? "PUT" : "POST"
      const url = isEditing ? `/api/trainers/${id}` : `/api/trainers`
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        Authorization: `Bearer ${token}`,
        body: JSON.stringify(formData),
      })
      navigate("/admin/trainers")
    } catch (error) {
      alert("Error saving trainer")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto px-2">
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/admin/trainers")}
          className={`p-2 rounded-lg ${theme === "dark" ? "text-gray-400 hover:bg-gray-700" : "text-gray-600 hover:bg-gray-100"}`}
        >
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className={`text-2xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            {isEditing ? "Edit Trainer" : "Add New Trainer"}
          </h1>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-4`}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Full Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required
                className="w-full px-3 py-2 border rounded-lg" placeholder="Enter full name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Role *</label>
              <input type="text" name="role" value={formData.role} onChange={handleChange} required
                className="w-full px-3 py-2 border rounded-lg" placeholder="e.g. Personal Trainer" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Instagram</label>
              <input type="url" name="instagram" value={formData.instagram} onChange={handleChange}
                className="w-full px-3 py-2 border rounded-lg" placeholder="https://instagram.com/..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Image URL *</label>
              <input type="url" name="image" value={formData.image} onChange={handleChange} required
                className="w-full px-3 py-2 border rounded-lg" placeholder="Image URL" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1">Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} required
                rows={3} className="w-full px-3 py-2 border rounded-lg" placeholder="Trainer bio" />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                type="checkbox"
                id="showOnFrontend"
                name="showOnFrontend"
                checked={formData.showOnFrontend}
                onChange={handleChange}
                className="h-5 w-5"
              />
              <label htmlFor="showOnFrontend" className="text-sm font-medium">
                Show this trainer on frontend
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center justify-end gap-4">
          <button type="button" onClick={() => navigate("/admin/trainers")}
            className="px-4 py-2 border rounded-lg">Cancel</button>
          <button type="submit" disabled={loading}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
            <Save size={16} className="mr-2" />
            {isEditing ? "Update Trainer" : "Create Trainer"}
          </button>
        </div>
      </form>
    </div>
  )
}

export default TrainerForm
