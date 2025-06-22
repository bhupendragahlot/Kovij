"use client"

import { useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTheme } from "../../../context/ThemeContext"
import { Plus, Search, Edit, Trash2, Eye, Package } from "lucide-react"

const API_URL = "/api/products"

const ProductsList = () => {
  const { theme } = useTheme()
  const navigate = useNavigate()
  const [searchTerm, setSearchTerm] = useState("")
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchProducts()
  }, [])
const token = localStorage.getItem("token");
  const fetchProducts = async () => {
    setLoading(true)
    try {
      const res = await fetch(API_URL)
      const data = await res.json()
      setProducts(data)
    } catch (err) {
      setProducts([])
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      await fetch(`${API_URL}/${id}`, { 
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      })
      fetchProducts()
    }
  }

  const handleToggleShow = async (id, current) => {
    await fetch(`${API_URL}/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" ,
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ showOnFrontend: !current }),
    })
    fetchProducts()
  }

  const filteredProducts = products.filter(
    (product) =>
      product.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchTerm.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className={`text-3xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>Products</h1>
          <p className={`mt-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>
            Manage your fitness products and supplements
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/products/new")}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
        >
          <Plus size={20} className="mr-2" />
          Add New Product
        </button>
      </div>

      {/* Search */}
      <div className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg p-4`}>
        <div className="relative">
          <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`} size={20} />
          <input
            type="text"
            placeholder="Search products..."
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

      {/* Products Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading...</div>
        ) : filteredProducts.length === 0 ? (
          <div className={`col-span-full text-center py-12 ${theme === "dark" ? "text-gray-400" : "text-gray-500"}`}>
            <Package size={48} className="mx-auto mb-4 opacity-50" />
            <p>No products found matching your search criteria.</p>
          </div>
        ) : (
          filteredProducts.map((product) => (
            <div
              key={product._id}
              className={`${theme === "dark" ? "bg-gray-800 border-gray-700" : "bg-white border-gray-200"} border rounded-lg overflow-hidden hover:shadow-lg transition-shadow duration-200 flex flex-col`}
            >
              <div className="aspect-w-16 aspect-h-9 bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                <img src={product.image || "/placeholder.svg"} alt={product.name} className="w-full h-48 object-cover" />
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <div className="flex items-start justify-between mb-2">
                  <h3 className={`text-lg font-semibold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>{product.name}</h3>
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    product.stock === 0 ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"
                  }`}>
                    {product.stock === 0 ? "Out of Stock" : "Active"}
                  </span>
                </div>
                <p className={`text-sm mb-2 ${theme === "dark" ? "text-gray-400" : "text-gray-600"}`}>{product.description}</p>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  <div><span className="font-semibold">Category:</span> {product.category}</div>
                  <div><span className="font-semibold">SKU:</span> {product.sku}</div>
                  <div><span className="font-semibold">Price:</span> ₹{product.price}</div>
                  <div><span className="font-semibold">Discount:</span> {product.discountPrice ? `₹${product.discountPrice}` : "-"}</div>
                  <div><span className="font-semibold">Stock:</span> {product.stock}</div>
                  <div><span className="font-semibold">Rating:</span> {product.rating}</div>
                  <div><span className="font-semibold">Badge:</span> {product.badge || "-"}</div>
                  <div><span className="font-semibold">Brand:</span> {product.brand || "-"}</div>
                </div>
                <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-200 dark:border-gray-700">
                  <span className="text-xs">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={product.showOnFrontend}
                        onChange={() => handleToggleShow(product._id, product.showOnFrontend)}
                        className="accent-red-500"
                      />
                      <span>Show on Frontend</span>
                    </label>
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => navigate(`/admin/products/view/${product._id}`)}
                      className={`p-2 rounded-lg transition-colors duration-200 ${theme === "dark" ? "text-blue-400 hover:bg-blue-900/20" : "text-blue-600 hover:bg-blue-50"}`}
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => navigate(`/admin/products/edit/${product._id}`)}
                      className={`p-2 rounded-lg transition-colors duration-200 ${theme === "dark" ? "text-yellow-400 hover:bg-yellow-900/20" : "text-yellow-600 hover:bg-yellow-50"}`}
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(product._id)}
                      className={`p-2 rounded-lg transition-colors duration-200 ${theme === "dark" ? "text-red-400 hover:bg-red-900/20" : "text-red-600 hover:bg-red-50"}`}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

export default ProductsList
