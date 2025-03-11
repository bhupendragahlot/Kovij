"use client"

import { motion } from "framer-motion"
import { FaClock } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Timing() {
  const { theme } = useTheme()

  const schedule = [
    { day: "Monday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Tuesday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Wednesday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Thursday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Friday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Saturday", hours: ["6–11 am", "4–9 pm"] },
    { day: "Sunday", hours: ["Closed"] },
  ]

  return (
    <section
      id="timing"
      className={`py-20 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-gradient-to-b from-gray-900 to-black" : "bg-gradient-to-b from-gray-100 to-white"
      }`}
    >
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              OPENING HOURS
            </span>
          </h2>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
            We're open throughout the week to accommodate your busy schedule.
          </p>
        </div>

        <motion.div
          className={`rounded-xl overflow-hidden border ${
            theme === "dark"
              ? "bg-gray-800/30 backdrop-blur-sm border-gray-700"
              : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
          }`}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          viewport={{ once: true }}
        >
          <div
            className={`p-6 flex items-center justify-center gap-3 ${
              theme === "dark"
                ? "bg-gradient-to-r from-red-600/20 to-yellow-600/20"
                : "bg-gradient-to-r from-red-500/10 to-yellow-500/10"
            }`}
          >
            <FaClock className="text-2xl text-red-500" />
            <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
              Weekly Schedule
            </h3>
          </div>

          <div className={`divide-y ${theme === "dark" ? "divide-gray-700" : "divide-gray-200"}`}>
            {schedule.map((item, index) => (
              <div
                key={index}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-6 ${
                  item.day === "Sunday" ? (theme === "dark" ? "bg-red-900/20" : "bg-red-100/50") : ""
                }`}
              >
                <div className={`font-bold text-lg mb-2 sm:mb-0 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  {item.day}
                </div>
                <div className="flex flex-col sm:items-end">
                  {item.hours.map((hour, idx) => (
                    <div
                      key={idx}
                      className={`${
                        hour === "Closed" ? "text-red-400" : theme === "dark" ? "text-gray-300" : "text-gray-600"
                      }`}
                    >
                      {hour}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Timing

