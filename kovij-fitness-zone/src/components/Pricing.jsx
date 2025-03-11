"use client"

import { motion } from "framer-motion"
import { FaCheck } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Pricing() {
  const { theme } = useTheme()

  const plans = [
    {
      name: "Basic",
      price: "999",
      duration: "month",
      features: [
        "Access to gym equipment",
        "Locker room access",
        "Basic fitness assessment",
        "2 group classes per week",
      ],
      popular: false,
      color: "from-gray-600 to-gray-700",
    },
    {
      name: "Premium",
      price: "1,999",
      duration: "month",
      features: [
        "Full access to all equipment",
        "Unlimited group classes",
        "Monthly fitness assessment",
        "1 personal training session/month",
        "Nutrition consultation",
      ],
      popular: true,
      color: "from-red-600 to-red-500",
    },
    {
      name: "Elite",
      price: "9,999",
      duration: "year",
      features: [
        "24/7 gym access",
        "Unlimited group classes",
        "Bi-weekly fitness assessment",
        "4 personal training sessions/month",
        "Customized nutrition plan",
        "Access to premium facilities",
      ],
      popular: false,
      color: "from-yellow-600 to-yellow-500",
    },
  ]

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`rounded-xl overflow-hidden border transition-all duration-300 transform hover:-translate-y-2 ${
                theme === "dark"
                  ? "bg-gray-800/30 backdrop-blur-sm border-gray-700 hover:border-red-500/50"
                  : "bg-white/70 backdrop-blur-sm border-gray-200 hover:border-red-500/50 shadow-sm"
              } ${plan.popular ? "ring-2 ring-red-500 ring-offset-2 ring-offset-gray-900" : ""}`}
            >
              {plan.popular && (
                <div className="bg-red-500 text-white text-center py-1 font-bold text-sm">MOST POPULAR</div>
              )}
              <div
                className={`p-8 bg-gradient-to-br ${plan.color} ${
                  theme === "dark" ? "bg-opacity-20" : "bg-opacity-10"
                }`}
              >
                <h3 className={`text-2xl font-bold mb-2 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  {plan.name}
                </h3>
                <div className="flex items-baseline">
                  <span className={`text-4xl font-extrabold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                    ₹{plan.price}
                  </span>
                  <span className={`ml-2 ${theme === "dark" ? "text-gray-300" : "text-gray-500"}`}>
                    /{plan.duration}
                  </span>
                </div>
              </div>
              <div className="p-8">
                <ul className="space-y-4">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start">
                      <FaCheck className="text-green-500 mt-1 mr-2 flex-shrink-0" />
                      <span className={theme === "dark" ? "text-gray-300" : "text-gray-600"}>{feature}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-8">
                  <a
                    href="#contact"
                    className={`block text-center py-3 px-6 rounded-full font-bold transition-all duration-300 transform hover:scale-105 ${
                      plan.popular
                        ? "bg-gradient-to-r from-red-600 to-red-500 text-white"
                        : theme === "dark"
                          ? "bg-white text-gray-900"
                          : "bg-gray-800 text-white"
                    }`}
                  >
                    GET STARTED
                  </a>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Pricing

