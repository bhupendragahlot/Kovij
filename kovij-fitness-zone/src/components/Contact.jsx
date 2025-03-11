

import { useState } from "react"
import { motion } from "framer-motion"
import { FaMapMarkerAlt, FaPhone, FaEnvelope, FaFacebook, FaInstagram, FaWhatsapp } from "react-icons/fa"
import { useTheme } from "../context/ThemeContext"

function Contact() {
  const { theme } = useTheme()
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    message: "",
  })

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitMessage, setSubmitMessage] = useState(null)

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      // Use the Vercel API route
      const response = await fetch("http://localhost:5000/api/send-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      })

      const data = await response.json()

      if (data.success) {
        setSubmitMessage({
          type: "success",
          text: "Thank you for your message! We will get back to you soon.",
        })
        setFormData({ name: "", email: "", phone: "", message: "" })
      } else {
        setSubmitMessage({
          type: "error",
          text: "Failed to send message. Please try again later.",
        })
      }
    } catch (error) {
      console.error("Error sending message:", error)
      setSubmitMessage({
        type: "error",
        text: "An error occurred. Please try again later.",
      })
    } finally {
      setIsSubmitting(false)

      // Clear success message after 5 seconds
      setTimeout(() => {
        setSubmitMessage(null)
      }, 5000)
    }
  }

  return (
    <section
      id="contact"
      className={`py-20 px-4 sm:px-6 lg:px-8 ${
        theme === "dark" ? "bg-gradient-to-b from-gray-900 to-black" : "bg-gradient-to-b from-gray-100 to-white"
      }`}
    >
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500">
              CONTACT US
            </span>
          </h2>
          <p className={`${theme === "dark" ? "text-gray-400" : "text-gray-600"} max-w-3xl mx-auto`}>
            Have questions or ready to start your fitness journey? Get in touch with us today.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className={`rounded-xl p-8 border ${
              theme === "dark"
                ? "bg-gray-800/30 backdrop-blur-sm border-gray-700"
                : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
            }`}
          >
            <h3 className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
              Send us a Message
            </h3>

            {submitMessage && (
              <div
                className={`p-4 mb-6 rounded-lg ${
                  submitMessage.type === "success" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                }`}
              >
                {submitMessage.text}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label htmlFor="name" className={`block mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                  Your Name
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    theme === "dark"
                      ? "bg-gray-700/50 border border-gray-600 text-white"
                      : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="John Doe"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="email" className={`block mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                  Email Address
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    theme === "dark"
                      ? "bg-gray-700/50 border border-gray-600 text-white"
                      : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="john@example.com"
                />
              </div>

              <div className="mb-4">
                <label htmlFor="phone" className={`block mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}>
                  Phone Number
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 ${
                    theme === "dark"
                      ? "bg-gray-700/50 border border-gray-600 text-white"
                      : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="+91 9876543210"
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="message"
                  className={`block mb-2 ${theme === "dark" ? "text-gray-300" : "text-gray-700"}`}
                >
                  Your Message
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="4"
                  className={`w-full px-4 py-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 resize-none ${
                    theme === "dark"
                      ? "bg-gray-700/50 border border-gray-600 text-white"
                      : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="I'm interested in joining your gym..."
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`w-full py-3 px-6 font-bold rounded-lg transition-all duration-300 transform hover:scale-105 disabled:opacity-70 disabled:cursor-not-allowed ${
                  theme === "dark"
                    ? "bg-gradient-to-r from-red-600 to-red-500 text-white"
                    : "bg-gradient-to-r from-red-700 to-red-600 text-white"
                }`}
              >
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
            </form>
          </motion.div>

          {/* Contact Information */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className="flex flex-col justify-between"
          >
            <div
              className={`rounded-xl p-8 border mb-8 ${
                theme === "dark"
                  ? "bg-gray-800/30 backdrop-blur-sm border-gray-700"
                  : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
              }`}
            >
              <h3 className={`text-2xl font-bold mb-6 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                Contact Information
              </h3>

              <div className="space-y-6">
                <div className="flex items-start">
                  <div className="bg-red-500 p-3 rounded-lg mr-4">
                    <FaMapMarkerAlt className="text-white text-xl" />
                  </div>
                  <div>
                    <h4 className={`font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Address</h4>
                    <a
                      href="https://maps.app.goo.gl/v99oCZ1vtRpuXTB66"
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`hover:text-red-400 transition-colors duration-300 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      120 Feet Rd, Chitresh Nagar, Manpura, Naya Nohra, Rajasthan 324004
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-red-500 p-3 rounded-lg mr-4">
                    <FaPhone className="text-white text-xl" />
                  </div>
                  <div>
                    <h4 className={`font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Phone</h4>
                    <a
                      href="tel:+919876543210"
                      className={`hover:text-red-400 transition-colors duration-300 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      +91 98765 43210
                    </a>
                  </div>
                </div>

                <div className="flex items-start">
                  <div className="bg-red-500 p-3 rounded-lg mr-4">
                    <FaEnvelope className="text-white text-xl" />
                  </div>
                  <div>
                    <h4 className={`font-bold mb-1 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Email</h4>
                    <a
                      href="mailto:info@kovijfitness.com"
                      className={`hover:text-red-400 transition-colors duration-300 ${
                        theme === "dark" ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      info@kovijfitness.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className={`font-bold mb-4 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>Follow Us</h4>
                <div className="flex space-x-4">
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-blue-600 p-3 rounded-full text-white hover:bg-blue-700 transition-colors duration-300"
                  >
                    <FaFacebook className="text-xl" />
                  </a>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-gradient-to-br from-purple-600 to-pink-500 p-3 rounded-full text-white hover:from-purple-700 hover:to-pink-600 transition-colors duration-300"
                  >
                    <FaInstagram className="text-xl" />
                  </a>
                  <a
                    href="https://wa.me/919876543210"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-green-600 p-3 rounded-full text-white hover:bg-green-700 transition-colors duration-300"
                  >
                    <FaWhatsapp className="text-xl" />
                  </a>
                </div>
              </div>
            </div>

            <div
              className={`rounded-xl overflow-hidden border h-80 ${
                theme === "dark"
                  ? "bg-gray-800/30 backdrop-blur-sm border-gray-700"
                  : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
              }`}
            >
              <iframe
                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3611.174260899382!2d75.8372!3d25.1234!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zMjXCsDA3JzI0LjIiTiA3NcKwNTAnMTMuOSJF!5e0!3m2!1sen!2sin!4v1647270832285!5m2!1sen!2sin"
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                title="Kovij Fitness Zone Location"
              ></iframe>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Contact

