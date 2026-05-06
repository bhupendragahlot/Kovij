import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { FaBolt, FaEnvelope, FaFacebook, FaInstagram, FaMapMarkerAlt, FaPhone, FaWhatsapp } from "react-icons/fa"
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
  const [settings, setSettings] = useState(null)

  // Fetch settings from backend
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => setSettings(null));
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const response = await fetch("/api/send-email", {
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
      setTimeout(() => {
        setSubmitMessage(null)
      }, 5000)
    }
  }

  return (
    <section
      id="contact"
      className={`kv-section ${
        theme === "dark" ? "bg-[#131313] text-[#e5e2e1]" : "bg-gradient-to-b from-gray-100 to-white"
      }`}
    >
      <div className="kv-container">
        <div className="mb-7 text-center sm:mb-10">
          <span className="kv-overline mb-3 text-[#f27a00]">
            SECURE CONTACT CHANNEL
          </span>
          <h2 className="kv-h2 text-white">
            CONTACT <span className="text-[#d32f2f]">US</span>
          </h2>
          <p className={`${theme === "dark" ? "text-[#ab8985]" : "text-gray-600"} kv-body mx-auto mt-3 max-w-3xl sm:mt-4`}>
            Send mission specs. We respond fast.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className={`kv-card ${
              theme === "dark"
                ? "bg-[#201f1f] border-[#393939]"
                : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
            } lg:col-span-7`}
          >
            <div className="mb-5 flex items-center gap-3 sm:mb-6">
              <span className="text-[#f27a00] text-xs font-black uppercase tracking-[0.2em] sm:text-sm">▶</span>
              <h3 className={`kv-h3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                Send a Message
              </h3>
            </div>

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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label
                    htmlFor="name"
                    className={`kv-label ${
                      theme === "dark" ? "text-[#ab8985]" : "text-gray-700"
                    }`}
                  >
                    Operative Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className={`kv-field ${
                      theme === "dark" ? "bg-[#131313] border border-[#393939] text-white" : "bg-gray-100 border border-gray-300 text-gray-800"
                    }`}
                    placeholder="GHOST"
                  />
                </div>
                <div>
                  <label
                    htmlFor="email"
                    className={`kv-label ${
                      theme === "dark" ? "text-[#ab8985]" : "text-gray-700"
                    }`}
                  >
                    Comms Channel (Email)
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className={`kv-field ${
                      theme === "dark" ? "bg-[#131313] border border-[#393939] text-white" : "bg-gray-100 border border-gray-300 text-gray-800"
                    }`}
                    placeholder="ops@kovij.fit"
                  />
                </div>
              </div>

              <div className="mt-4">
                <label
                  htmlFor="phone"
                  className={`kv-label ${
                    theme === "dark" ? "text-[#ab8985]" : "text-gray-700"
                  }`}
                >
                  Encrypted ID (Phone)
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  className={`kv-field ${
                    theme === "dark" ? "bg-[#131313] border border-[#393939] text-white" : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="+1 (555) 000-0000"
                />
              </div>

              <div className="mt-4 mb-6">
                <label
                  htmlFor="message"
                  className={`kv-label ${
                    theme === "dark" ? "text-[#ab8985]" : "text-gray-700"
                  }`}
                >
                  Mission Specs (Message)
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows="5"
                  className={`kv-field resize-none ${
                    theme === "dark" ? "bg-[#131313] border border-[#393939] text-white" : "bg-gray-100 border border-gray-300 text-gray-800"
                  }`}
                  placeholder="REASON FOR CONTACT..."
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className={`fx-hoverlift fx-press w-full px-6 py-3.5 text-[11px] font-black uppercase tracking-[0.22em] transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed sm:py-4 sm:text-xs ${
                  theme === "dark" ? "bg-[#d32f2f] text-white hover:bg-[#930010]" : "bg-gradient-to-r from-red-700 to-red-600 text-white"
                }`}
              >
                {isSubmitting ? "SENDING..." : (
                  <span className="inline-flex items-center justify-center gap-2">
                    SEND MISSION SPECS <FaBolt />
                  </span>
                )}
              </button>
            </form>
          </motion.div>

          {/* Base of Operations */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            viewport={{ once: true }}
            className={`kv-card ${
              theme === "dark" ? "bg-[#201f1f] border-[#393939]" : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
            } lg:col-span-5`}
          >
              <div className="flex items-center justify-between">
                <h3 className={`kv-h3 ${theme === "dark" ? "text-white" : "text-gray-800"}`}>
                  Base of Operations
                </h3>
                <span className="text-[10px] font-black uppercase tracking-[0.22em] text-[#f27a00]">HQ</span>
              </div>

              <div className="mt-6 space-y-4">
                <div className="flex items-start gap-3 border-l-4 border-[#f27a00] bg-[#131313] p-3 sm:gap-4 sm:p-4">
                  <div className="mt-1 text-[#f27a00]">
                    <FaMapMarkerAlt />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ab8985]">HQ Address</div>
                    <a
                      href={settings?.mapEmbedUrl || "https://maps.app.goo.gl/v99oCZ1vtRpuXTB66"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block text-xs font-bold text-white hover:text-[#f27a00] sm:text-sm"
                    >
                      {settings?.address || "120 Feet Rd, Chitresh Nagar, Manpura, Naya Nohra, Rajasthan 324004"}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-l-4 border-[#f27a00] bg-[#131313] p-3 sm:gap-4 sm:p-4">
                  <div className="mt-1 text-[#f27a00]">
                    <FaPhone />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ab8985]">Direct Line</div>
                    <a
                      href={`tel:${settings?.phone || "+919057027053"}`}
                      className="mt-1 block text-xs font-bold text-white hover:text-[#f27a00] sm:text-sm"
                    >
                      {settings?.phone || "+919057027053"}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3 border-l-4 border-[#f27a00] bg-[#131313] p-3 sm:gap-4 sm:p-4">
                  <div className="mt-1 text-[#f27a00]">
                    <FaEnvelope />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.22em] text-[#ab8985]">Secure Inbox</div>
                    <a
                      href={`mailto:${settings?.email || "info@kovijfitness.com"}`}
                      className="mt-1 block text-xs font-bold text-white hover:text-[#f27a00] sm:text-sm"
                    >
                      {settings?.email || "info@kovijfitness.com"}
                    </a>
                  </div>
                </div>
              </div>

              <div className="mt-8">
                <h4 className={`text-[10px] font-black uppercase tracking-[0.22em] mb-4 ${theme === "dark" ? "text-[#ab8985]" : "text-gray-800"}`}>Social</h4>
                <div className="flex space-x-4">
                  <a
                    href={settings?.facebook || "https://facebook.com"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kv-iconBtn border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-[#d32f2f] hover:text-[#d32f2f]"
                  >
                    <FaFacebook className="text-base sm:text-xl" />
                  </a>
                  <a
                    href={settings?.instagram || "https://www.instagram.com/kovij_fitness_zone?igsh=MWR4aWdiYm0wN210dA=="}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kv-iconBtn border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-[#f27a00] hover:text-[#f27a00]"
                  >
                    <FaInstagram className="text-base sm:text-xl" />
                  </a>
                  <a
                    href={settings?.whatsapp ? `https://wa.me/${settings.whatsapp}` : "https://wa.me/+919057027053"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="kv-iconBtn border-neutral-700 bg-neutral-950 text-neutral-300 hover:border-[#f7be1d] hover:text-[#f7be1d]"
                  >
                    <FaWhatsapp className="text-base sm:text-xl" />
                  </a>
                </div>
              </div>
          </motion.div>

          {/* Strategic Map */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.55, delay: 0.05 }}
            viewport={{ once: true }}
            className={`rounded-xl overflow-hidden border relative h-64 sm:h-72 lg:h-80 ${
              theme === "dark" ? "bg-[#201f1f] border-[#393939]" : "bg-white/70 backdrop-blur-sm border-gray-200 shadow-sm"
            } lg:col-span-5`}
          >
              {theme === "dark" && (
                <>
                  <div className="pointer-events-none absolute right-3 top-3 bg-[#d32f2f] px-2 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-white">
                    GPS LOCKED
                  </div>
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    <div className="flex flex-col items-center">
                      <div className="animate-float-slow">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#d32f2f] text-white shadow-[0_0_20px_rgba(211,47,47,0.5)]">
                          <FaMapMarkerAlt />
                        </div>
                      </div>
                      <div className="mt-3 border border-neutral-700 bg-black/60 px-3 py-2 text-center">
                        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-white">Strategic Map</div>
                        <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400">Encrypted Feed Active</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
              <iframe
                src={settings?.mapEmbedUrl || "https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3712.1985550394793!2d75.89803922711107!3d25.179997694741587!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396f911faffd7c31%3A0xec54a1034fdf7b9a!2sKovij%20Fitness%20Zone!5e0!3m2!1sen!2sin!4v1742579483445!5m2!1sen!2sin"}
                width="100%"
                height="100%"
                style={{ border: 0 }}
                allowFullScreen=""
                loading="lazy"
                title="Kovij Fitness Zone Location"
              ></iframe>
          </motion.div>
        </div>
      </div>
    </section>
  )
}

export default Contact

