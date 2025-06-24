"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaCheck } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Pricing() {
  const { theme } = useTheme()
  const [plans, setPlans] = useState([])

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const res = await fetch('/api/plans')
        const data = await res.json()
        // Filter plans where showOnFrontend is true
        const filtered = (data.plans || []).filter(p => p.showOnFrontend)
        setPlans(filtered)
      } catch (err) {
        setPlans([])
      }
    }
    fetchPlans()
  }, [])

  return (
    <section
      id="pricing"
      className={`py-20 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-gradient-to-b from-black to-gray-900" : "bg-gradient-to-b from-white to-gray-100"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              MEMBERSHIP PLANS
            </span>
          </h2>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
            Choose the perfect membership plan that fits your fitness goals and budget.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`
                relative rounded-3xl overflow-hidden shadow-xl border-0
                transition-all duration-300 transform hover:-translate-y-2 hover:scale-105
                ${plan.popular ? "ring-4 ring-red-500/70" : ""}
                ${theme === "dark"
                  ? "bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700"
                  : "bg-gradient-to-br from-white via-gray-50 to-gray-100"}
              `}
              style={{
                boxShadow: plan.popular
                  ? "0 8px 32px 0 rgba(255, 0, 0, 0.15)"
                  : "0 4px 24px 0 rgba(0,0,0,0.07)"
              }}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-red-600 to-yellow-500 text-white text-center py-2 font-bold text-xs tracking-widest shadow-lg z-10 rounded-t-3xl">
                  MOST POPULAR
                </div>
              )}
              <div
                className={`p-10 pt-14 flex flex-col h-full bg-clip-padding backdrop-blur-md`}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className={`text-2xl font-extrabold tracking-tight ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    {plan.name}
                  </h3>
                  {/* Status Badge */}
                  <span
                    className={`ml-2 px-3 py-1 rounded-full text-xs font-semibold shadow ${
                      plan.status === "Active"
                        ? "bg-green-100 text-green-700 border border-green-300"
                        : "bg-gray-300 text-gray-700 border border-gray-400"
                    }`}
                  >
                    {plan.status}
                  </span>
                </div>
                <div className="flex items-end mb-6">
                  <span className={`text-5xl font-extrabold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    ₹{plan.price}
                  </span>
                  <span className={`ml-2 mb-1 text-lg ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`}>
                    /{plan.duration}
                  </span>
                </div>
                <ul className="space-y-4 mb-8 flex-1">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <FaCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                      <span className={theme === "dark" ? "text-gray-300" : "text-gray-700"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <a
                  href="#contact"
                  className={`
                    block text-center py-3 px-6 rounded-full font-bold transition-all duration-300 transform hover:scale-105
                    ${plan.popular
                      ? "bg-gradient-to-r from-red-600 to-yellow-500 text-white shadow-lg"
                      : theme === "dark"
                        ? "bg-white text-gray-900 shadow"
                        : "bg-gray-900 text-white shadow"}
                  `}
                >
                  GET STARTED
                </a>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Pricing

