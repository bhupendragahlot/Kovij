"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { FaShoppingCart, FaStar } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Shop() {
  const [activeCategory, setActiveCategory] = useState("all")
  const { theme } = useTheme()

  const categories = [
    { id: "all", name: "All Products" },
    { id: "protein", name: "Protein" },
    { id: "preworkout", name: "Pre-Workout" },
    { id: "vitamins", name: "Vitamins & Minerals" },
    { id: "accessories", name: "Accessories" },
  ]

  const products = [
    {
      id: 1,
      name: "Whey Protein Isolate",
      category: "protein",
      price: 2499,
      discountPrice: 1999,
      rating: 4.8,
      image: "/images/product-1.jpg",
      badge: "Best Seller",
    },
    {
      id: 2,
      name: "Pre-Workout Energy Booster",
      category: "preworkout",
      price: 1899,
      discountPrice: 1499,
      rating: 4.5,
      image: "/images/product-2.jpg",
      badge: "20% OFF",
    },
    {
      id: 3,
      name: "BCAA Amino Acids",
      category: "protein",
      price: 1299,
      discountPrice: 999,
      rating: 4.3,
      image: "/images/product-3.jpg",
      badge: "New",
    },
    {
      id: 4,
      name: "Multivitamin Complex",
      category: "vitamins",
      price: 899,
      discountPrice: 799,
      rating: 4.6,
      image: "/images/product-4.jpg",
    },
    {
      id: 5,
      name: "Creatine Monohydrate",
      category: "protein",
      price: 1199,
      discountPrice: 999,
      rating: 4.7,
      image: "/images/product-5.jpg",
      badge: "Popular",
    },
    {
      id: 6,
      name: "Gym Shaker Bottle",
      category: "accessories",
      price: 499,
      discountPrice: 399,
      rating: 4.4,
      image: "/images/product-6.jpg",
    },
    {
      id: 7,
      name: "Weight Lifting Gloves",
      category: "accessories",
      price: 799,
      discountPrice: 649,
      rating: 4.2,
      image: "/images/product-7.jpg",
    },
    {
      id: 8,
      name: "Vitamin D3 + K2",
      category: "vitamins",
      price: 699,
      discountPrice: 599,
      rating: 4.5,
      image: "/images/product-8.jpg",
    },
  ]

  const filteredProducts =
    activeCategory === "all" ? products : products.filter((product) => product.category === activeCategory)

  return (
    <div
      className={`min-h-screen pt-20 pb-12 px-4 sm:px-6 lg:px-8 ${theme === "dark" ? "bg-gradient-to-b from-black to-gray-900" : "bg-gradient-to-b from-white to-gray-100"}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              SUPPLEMENTS & ACCESSORIES
            </span>
          </h1>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
            Enhance your fitness journey with our premium selection of supplements and gym accessories.
          </p>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => setActiveCategory(category.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all duration-300 ${
                activeCategory === category.id
                  ? "bg-red-500 text-white"
                  : theme === "dark"
                    ? "bg-gray-800 text-gray-300 hover:bg-gray-700"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>

        {/* Products */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {filteredProducts.map((product, index) => (
            <motion.div
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className={`${
                theme === "dark"
                  ? "bg-gray-800/30 backdrop-blur-sm border-gray-700"
                  : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
              } 
                rounded-xl overflow-hidden border hover:border-red-500/50 transition-all duration-300 group`}
            >
              <div className="relative overflow-hidden">
                <img
                  src={product.image || "/placeholder.svg"}
                  alt={product.name}
                  className="w-full h-64 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                {product.badge && (
                  <div className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded">
                    {product.badge}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                  <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full flex items-center gap-2 transition-colors duration-300">
                    <FaShoppingCart />
                    <span>Add to Cart</span>
                  </button>
                </div>
              </div>
              <div className="p-4">
                <h3 className={`text-lg font-bold ${theme === "dark" ? "text-white" : "text-gray-900"} mb-1`}>
                  {product.name}
                </h3>
                <div className="flex items-center mb-2">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <FaStar
                        key={i}
                        className={i < Math.floor(product.rating) ? "text-yellow-400" : "text-gray-600"}
                      />
                    ))}
                  </div>
                  <span className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} text-sm ml-2`}>
                    {product.rating}
                  </span>
                </div>
                <div className="flex items-center">
                  <span className="text-red-500 font-bold">₹{product.discountPrice}</span>
                  {product.discountPrice < product.price && (
                    <span
                      className={`${theme === "dark" ? "text-gray-500" : "text-gray-500"} line-through text-sm ml-2`}
                    >
                      ₹{product.price}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default Shop

