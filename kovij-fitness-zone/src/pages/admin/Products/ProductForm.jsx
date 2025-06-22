"use client"

import { useState, useEffect } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { ArrowLeft, Save } from "lucide-react"

const API_URL = "/api/products"

const initialState = {
  name: "",
  description: "",
  price: "",
  discountPrice: "",
  category: "",
  stock: "",
  rating: "",
  image: "",
  badge: "",
  sku: "",
  brand: "",
  showOnFrontend: true,
}

const ProductForm = () => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const { id } = useParams()
  const isEditing = Boolean(id)

  const [formData, setFormData] = useState(initialState)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isEditing) {
      fetch(`${API_URL}/${id}`)
        .then(res => res.json())
        .then(data => setFormData({
          ...initialState,
          ...data,
          price: data.price ?? "",
          discountPrice: data.discountPrice ?? "",
          stock: data.stock ?? "",
          rating: data.rating ?? "",
        }))
    }
  }, [isEditing, id])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const token = localStorage.getItem("token");
      const method = isEditing ? "PUT" : "POST"
      const url = isEditing ? `${API_URL}/${id}` : API_URL
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
         },
        body: JSON.stringify({
          ...formData,
          price: Number(formData.price),
          discountPrice: formData.discountPrice ? Number(formData.discountPrice) : undefined,
          stock: Number(formData.stock),
          rating: formData.rating ? Number(formData.rating) : 0,
        }),
      })
      navigate("/admin/products")
    } catch (error) {
      alert("Error saving product")
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/admin/products")}
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
            {isEditing ? "Edit Product" : "Add New Product"}
          </h1>
          <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            {isEditing ? "Update product information" : "Create a new product"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-4`}>
          <h2 className={`text-lg font-semibold mb-6 ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
            Product Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Product Name *</label>
              <input type="text" name="name" value={formData.name} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter product name" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>SKU *</label>
              <input type="text" name="sku" value={formData.sku} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter SKU" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Category *</label>
              <select name="category" value={formData.category} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white" : "bg-white border-gray-300 text-gray-900"}`}>
                <option value="">Select category</option>
                <option value="protein">Protein</option>
                <option value="preworkout">Preworkout</option>
                <option value="vitamins">Vitamins</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Brand</label>
              <input type="text" name="brand" value={formData.brand} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter brand name" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Price (₹) *</label>
              <input type="number" name="price" value={formData.price} onChange={handleChange} required min="0" step="0.01" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter price" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Discount Price (₹)</label>
              <input type="number" name="discountPrice" value={formData.discountPrice} onChange={handleChange} min="0" step="0.01" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter discount price" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Stock Quantity *</label>
              <input type="number" name="stock" value={formData.stock} onChange={handleChange} required min="0" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter stock quantity" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Rating</label>
              <input type="number" name="rating" value={formData.rating} onChange={handleChange} min="0" max="5" step="0.1" className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="0-5" />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Image URL *</label>
              <input type="text" name="image" value={formData.image} onChange={handleChange} required className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="https://..." />
            </div>
            <div>
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Badge</label>
              <input type="text" name="badge" value={formData.badge} onChange={handleChange} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="e.g. Best Seller" />
            </div>
            <div className="md:col-span-2">
              <label className={`block text-sm font-medium mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Description *</label>
              <textarea name="description" value={formData.description} onChange={handleChange} required rows={3} className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent ${theme === "dark" ? "bg-gray-700 border-gray-600 text-white placeholder-gray-400" : "bg-white border-gray-300 text-gray-900 placeholder-gray-500"}`} placeholder="Enter product description" />
            </div>
            <div className="flex items-center gap-2 mt-2">
              <input type="checkbox" name="showOnFrontend" checked={formData.showOnFrontend} onChange={handleChange} className="accent-red-500" id="showOnFrontend" />
              <label htmlFor="showOnFrontend" className={`text-sm font-medium ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>Show on Frontend</label>
            </div>
          </div>
        </div>
        {/* Form Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button type="button" onClick={() => navigate("/admin/products")} className={`px-6 py-2 border rounded-lg transition-colors duration-200 ${theme === "dark" ? "border-gray-600 text-gray-300 hover:bg-gray-700" : "border-gray-300 text-gray-700 hover:bg-gray-50"}`}>Cancel</button>
          <button type="submit" disabled={loading} className="inline-flex items-center px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200">
            {loading ? (<><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>Saving...</>) : (<><Save size={16} className="mr-2" />{isEditing ? "Update Product" : "Create Product"}</>)}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ProductForm
