"use client"

import { motion } from "framer-motion"
import { FaClock } from "react-icons/fa"

function Timing() {
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
    <section id="timing" className="bg-[#0e0e0e] px-4 py-20 text-[#e5e2e1] sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl px-0">
        <div className="mb-12 text-center">
          <h2 className="font-['Lexend'] text-4xl font-black uppercase text-white md:text-5xl">OPENING HOURS</h2>
          <p className="mx-auto mt-3 max-w-2xl text-[#ab8985]">
            We&apos;re open all week to match your schedule. Train early. Train late. Stay consistent.
          </p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.5 }}
          className="relative overflow-hidden border border-neutral-800 bg-[#131313]"
        >
          <div className="absolute left-0 top-0 h-full w-1 bg-[#d32f2f]" />

          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center border border-[#393939] bg-[#1c1b1b] text-[#d32f2f]">
                <FaClock />
              </div>
              <div>
                <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#ab8985]">Operations</span>
                <h3 className="font-['Lexend'] text-2xl font-black uppercase text-white">Weekly Schedule</h3>
              </div>
            </div>

            <div className="text-left md:text-right">
              <span className="block text-[10px] font-bold uppercase tracking-[0.18em] text-[#ab8985]">Tip</span>
              <p className="text-sm text-neutral-300">Arrive 10 min early for warm-up and form checks.</p>
            </div>
          </div>

          <div className="border-t border-neutral-800">
            {schedule.map((item, index) => {
              const isClosed = item.hours.length === 1 && item.hours[0] === "Closed"
              return (
                <div
                  key={index}
                  className={`flex flex-col gap-3 border-b border-neutral-800 px-8 py-6 transition-colors md:flex-row md:items-center md:justify-between ${
                    isClosed ? "bg-[#d32f2f]/10" : "hover:bg-white/5"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`h-2 w-2 ${isClosed ? "bg-[#d32f2f]" : "bg-[#f27a00]"}`} />
                    <div className="font-['Lexend'] text-lg font-black uppercase text-white">{item.day}</div>
                  </div>
                  <div className="flex flex-col gap-1 md:items-end">
                    {item.hours.map((hour, idx) => (
                      <div
                        key={idx}
                        className={`text-sm font-bold uppercase tracking-wide ${
                          hour === "Closed" ? "text-[#ffb4ab]" : "text-neutral-300"
                        }`}
                      >
                        {hour}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export default Timing

