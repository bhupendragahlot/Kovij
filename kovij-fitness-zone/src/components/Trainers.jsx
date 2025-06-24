import { motion } from "framer-motion"
import { FaInstagram } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"
import { useState, useEffect } from "react"

function Trainers() {
  const { theme } = useTheme()
  const [trainers, setTrainers] = useState([])

  useEffect(() => {
    const fetchTrainers = async () => {
      try {
        const res = await fetch('/api/trainers')
        const data = await res.json()
        // Filter trainers where showOnFrontend is true
        const filtered = (data.trainers || []).filter(t => t.showOnFrontend)
        setTrainers(filtered)
      } catch (err) {
        setTrainers([])
      }
    }
    fetchTrainers()
  }, [])

  return (
    <section
      id="trainers"
      className={`py-20 px-4 sm:px-6 lg:px-8 ${theme === "dark" ? "bg-gradient-to-b from-black to-gray-900" : "bg-gradient-to-b from-white to-gray-100"}`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              OUR EXPERT TRAINERS
            </span>
          </h2>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
            Meet our team of certified fitness professionals dedicated to helping you achieve your goals.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {trainers.map((trainer, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              viewport={{ once: true }}
              className={`${
                theme === "dark" ? "bg-gray-800/30 backdrop-blur-sm" : "bg-white/70 backdrop-blur-sm shadow-sm"
              } rounded-xl overflow-hidden group`}
            >
              <div className="relative overflow-hidden">
                <img
                  src={trainer.image || "/placeholder.svg"}
                  alt={trainer.name}
                  className="w-full h-72 object-cover transition-transform duration-500 group-hover:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end">
                  <div className="p-4 w-full">
                    <a
                      href={trainer.instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 bg-red-500 hover:bg-red-600 text-white py-2 rounded-full transition-colors duration-300"
                    >
                      <FaInstagram className="text-lg" />
                      <span>Follow on Instagram</span>
                    </a>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <h3 className={`text-xl font-bold ${theme === "dark" ? "text-white" : "text-gray-900"}`}>
                  {trainer.name}
                </h3>
                <p className="text-red-400 mb-2">{trainer.role}</p>
                <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} text-sm`}>
                  {trainer.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default Trainers
