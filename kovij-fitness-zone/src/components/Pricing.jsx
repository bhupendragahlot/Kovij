"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaCheckCircle } from "react-icons/fa"
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
        <div className="text-center mb-14">
          <span className="mb-3 block text-xs font-bold uppercase tracking-[0.26em] text-[#f27a00]">
            ENGINEERED FOR PERFORMANCE
          </span>
          <h2 className="font-['Lexend'] text-4xl md:text-5xl font-black uppercase text-white">
            CHOOSE YOUR INTENSITY
          </h2>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto mt-4`}>
            No fluff. No distractions. Just pure results. Select the tier that matches your ambition.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-end">
          {plans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ y: -10 }}
              className={`relative border ${
                plan.popular
                  ? "border-[#d32f2f] bg-[#2a2a2a] glow-crimson scale-[1.02] z-10"
                  : "border-[#5b403d] bg-[#201f1f]"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-[#d32f2f] px-4 py-1 text-xs font-black uppercase tracking-[0.16em] text-white">
                  MOST POPULAR
                </div>
              )}
              <div className={`p-8 flex flex-col h-full ${plan.popular ? "pt-10" : ""}`}>
                <div className="mb-6">
                  <h3 className={`font-['Lexend'] text-3xl font-black uppercase ${plan.popular ? "text-[#fff2f0]" : "text-white"}`}>
                    {plan.name}
                  </h3>
                  <div className="mt-3 flex items-baseline gap-2">
                    <span className={`font-['Lexend'] text-5xl font-black ${plan.popular ? "text-[#d32f2f]" : "text-[#e5e2e1]"}`}>
                      ₹{plan.price}
                    </span>
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#ab8985]">/{plan.duration}</span>
                  </div>
                  <div className="mt-3">
                    <span
                      className={`inline-flex items-center border px-3 py-1 text-[10px] font-black uppercase tracking-[0.16em] ${
                        plan.status === "Active"
                          ? "border-[#f27a00] text-[#f27a00]"
                          : "border-neutral-700 text-neutral-500"
                      }`}
                    >
                      {plan.status || "Active"}
                    </span>
                  </div>
                </div>

                <ul className="space-y-3 mb-8 flex-1 text-[#e4beba]">
                  {(plan.features || []).map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <FaCheckCircle className={`${plan.popular ? "text-[#d32f2f]" : "text-[#f27a00]"} mt-0.5`} />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                <a
                  href="#contact"
                  className={`w-full py-3 text-center text-xs font-black uppercase tracking-[0.2em] transition ${
                    plan.popular
                      ? "corner-cut-tr bg-[#d32f2f] text-white hover:bg-[#930010]"
                      : "corner-cut-bl border-2 border-[#f27a00] text-[#f27a00] hover:bg-[#f27a00]/10"
                  }`}
                >
                  {plan.popular ? "GO PRO" : `SELECT ${String(plan.name || "PLAN").toUpperCase()}`}
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

