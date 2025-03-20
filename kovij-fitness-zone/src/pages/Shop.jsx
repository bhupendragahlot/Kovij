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
      image: "https://imgs.search.brave.com/Ckjd05tsIs4QgvuMMRJkITTvdIiIqduxzY_6IRGEcQw/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9zaG9w/LmJvZHlidWlsZGlu/Zy5jb20vY2RuL3No/b3AvZmlsZXMva2Fn/ZWQtd2hleS1wcm90/ZWluLWlzb2xhdGUt/NDkxNDM2LmpwZz9j/cm9wPWNlbnRlciZo/ZWlnaHQ9MjA0OCZ2/PTE3MzAzNjcwMzIm/d2lkdGg9MjA0OA",
      badge: "Best Seller",
    },
    {
      id: 2,
      name: "Pre-Workout Energy Booster",
      category: "preworkout",
      price: 1899,
      discountPrice: 1499,
      rating: 4.5,
      image: "https://imgs.search.brave.com/6VVg1MNWl-0ErZ5rh3sc3xEAN12mQgU-gNgiHtwod9E/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/ODF1cGlrSkppQ0wu/anBn",
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
      image: "https://imgs.search.brave.com/qZp0nYP-m3W-OGkn7ifJWUoLseBCTQhQoReuLJ54FDA/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly93d3cu/Z29yaWxsYXdlYXIu/Y29tL3Jlc2l6ZS85/OTgwMzkwOC13b21l/bnMtZml0bmVzcy1n/bG92ZXMtMjAtYmxh/Y2stZ3JheS0xXzM4/MjAwMTUwNTg5NDgu/anBnLzUwMC81MDAv/VHJ1ZS93b21lbi1z/LWZpdG5lc3MtZ2xv/dmVzLTIwLWJsYWNr/LWdyYXkuanBn",
    },
    {
      id: 8,
      name: "Vitamin D3 + K2",
      category: "vitamins",
      price: 699,
      discountPrice: 599,
      rating: 4.5,
      image: "https://imgs.search.brave.com/aEXrGmsMyDpJIZaGWAz2inMtkgz9e4cipQlSESQpvxg/rs:fit:500:0:0:0/g:ce/aHR0cHM6Ly9tLm1l/ZGlhLWFtYXpvbi5j/b20vaW1hZ2VzL0kv/NDFIcUlLRjlHVEwu/anBn",
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
                {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-4">
                  <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded-full flex items-center gap-2 transition-colors duration-300">
                    <FaShoppingCart />
                    <span>Add to Cart</span>
                  </button>
                </div> */}
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

