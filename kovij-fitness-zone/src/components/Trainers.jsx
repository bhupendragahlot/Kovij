import { motion } from "framer-motion"
import { useState, useEffect } from "react"
import { FaArrowRight, FaChartLine, FaCheckCircle, FaPlay } from "react-icons/fa"

function Trainers() {
  const [trainers, setTrainers] = useState([])
  const [loading, setLoading] = useState(true)

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
      } finally {
        setLoading(false)
      }
    }
    fetchTrainers()
  }, [])

  const featured = trainers.slice(0, 2)
  const smallCards = trainers.slice(2, 5)
  const overflowSmall = trainers.slice(5)

  return (
    <section id="trainers" className="kv-section overflow-x-hidden bg-[#131313] text-[#e5e2e1]">
      <header className="kv-container mb-7 sm:mb-10">
        <div className="flex flex-col gap-6 border-l-4 border-[#d32f2f] py-4 pl-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="kv-overline mb-2 text-[#ffb786]">The Elite Squad</span>
            <h2 className="font-['Lexend'] text-3xl font-black uppercase italic leading-none text-white sm:text-4xl lg:text-6xl">
              Expert <span className="text-[#d32f2f] not-italic">Trainers</span>
            </h2>
          </div>
          <p className="kv-body max-w-md text-neutral-400">
            Uncompromising standards. Professional backgrounds. Our trainers don&apos;t just instruct—they engineer performance.
          </p>
        </div>
      </header>

      {loading ? (
        <div className="kv-container py-12 text-center text-neutral-500 sm:py-16">Loading trainers…</div>
      ) : trainers.length === 0 ? (
        <div className="kv-container py-12 text-center text-neutral-500 sm:py-16">No trainers available right now.</div>
      ) : (
        <section className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-4 px-4 sm:px-6 lg:px-8 md:grid-cols-2 lg:grid-cols-12">
          {featured[0] && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group relative flex min-h-[380px] flex-col justify-end overflow-hidden border border-neutral-800 bg-[#201f1f] sm:min-h-[440px] lg:col-span-7 lg:min-h-[500px]"
            >
              <img
                src={featured[0].image || "/placeholder.svg"}
                alt={featured[0].name}
                className="absolute inset-0 h-full w-full object-cover object-center grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-[#131313]/40 to-transparent" />
              <div className="relative mb-5 ml-4 max-w-lg border-l-4 border-[#d32f2f] bg-[#131313]/80 p-4 backdrop-blur-sm sm:mb-6 sm:ml-6 sm:p-6">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="bg-[#393939] px-3 py-1 text-[10px] font-bold uppercase text-white">Strength</span>
                  <span className="bg-[#393939] px-3 py-1 text-[10px] font-bold uppercase text-white">Coach</span>
                </div>
                <h3 className="font-['Lexend'] text-xl font-black uppercase italic text-white sm:text-2xl lg:text-3xl">{featured[0].name}</h3>
                <p className="mb-4 mt-2 font-body-md text-neutral-300">&quot;{featured[0].description}&quot;</p>
                <div className="flex flex-wrap items-center gap-6">
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#d32f2f]">Experience</span>
                    <p className="font-['Lexend'] text-base font-bold text-white sm:text-xl">Certified</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase text-[#d32f2f]">Focus</span>
                    <p className="font-['Lexend'] text-base font-bold text-white sm:text-xl">{featured[0].role}</p>
                  </div>
                  <a
                    href={featured[0].instagram || "#contact"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="corner-cut-tr ml-auto flex h-12 w-12 items-center justify-center bg-[#f27a00] text-[#502400] transition hover:bg-[#f7be1d]"
                    aria-label={`Profile ${featured[0].name}`}
                  >
                    <FaArrowRight />
                  </a>
                </div>
              </div>
            </motion.article>
          )}

          {featured[1] && (
            <motion.article
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.05 }}
              className="group relative flex min-h-[420px] flex-col justify-end overflow-hidden border border-neutral-800 bg-[#201f1f] lg:col-span-5"
            >
              <img
                src={featured[1].image || "/placeholder.svg"}
                alt={featured[1].name}
                className="absolute inset-0 h-full w-full object-cover object-top grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#131313] via-transparent to-transparent" />
              <div className="relative mb-6 ml-6 border-l-4 border-[#f27a00] bg-[#131313]/80 p-6 backdrop-blur-sm">
                <div className="mb-3 flex flex-wrap gap-2">
                  <span className="bg-[#393939] px-3 py-1 text-[10px] font-bold uppercase text-white">Coach</span>
                  <span className="bg-[#393939] px-3 py-1 text-[10px] font-bold uppercase text-white">Mobility</span>
                </div>
                <h3 className="font-['Lexend'] text-3xl font-black uppercase italic text-white">{featured[1].name}</h3>
                <p className="mb-4 mt-2 text-neutral-300">{featured[1].description}</p>
                <a
                  href={featured[1].instagram || "#contact"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#ffb786] transition-all group-hover:gap-5"
                >
                  View Profile <FaArrowRight className="text-sm" />
                </a>
              </div>
            </motion.article>
          )}

          {smallCards.map((trainer, i) => (
            <motion.article
              key={trainer._id || trainer.id || `${trainer.name}-${i}`}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: 0.06 * i }}
              className="group relative flex aspect-square flex-col justify-end overflow-hidden border border-neutral-800 bg-[#201f1f] lg:col-span-4"
            >
              <img
                src={trainer.image || "/placeholder.svg"}
                alt={trainer.name}
                className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-110 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-neutral-900/40 transition-all group-hover:bg-transparent" />
              <div className={`relative border-t bg-neutral-950/90 p-4 ${i % 2 === 0 ? "border-[#d32f2f]" : "border-[#f27a00]"}`}>
                <h4 className="font-['Lexend'] text-xl font-black uppercase text-white">{trainer.name}</h4>
                <span className={`text-xs font-bold uppercase tracking-widest ${i % 2 === 0 ? "text-[#d32f2f]" : "text-[#ffb786]"}`}>
                  {trainer.role}
                </span>
              </div>
            </motion.article>
          ))}
        </section>
      )}

      {!loading && overflowSmall.length > 0 && (
        <section className="mx-auto mt-4 grid max-w-7xl grid-cols-1 gap-4 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {overflowSmall.map((trainer, i) => (
            <motion.article
              key={trainer._id || trainer.id || `extra-${trainer.name}-${i}`}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden border border-neutral-800 bg-[#201f1f]"
            >
              <img
                src={trainer.image || "/placeholder.svg"}
                alt={trainer.name}
                className="absolute inset-0 h-full w-full object-cover grayscale transition-all duration-700 group-hover:scale-105 group-hover:grayscale-0"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent" />
              <div className="relative p-4">
                <h4 className="font-['Lexend'] text-lg font-black uppercase text-white">{trainer.name}</h4>
                <span className="text-xs font-bold uppercase tracking-widest text-[#d32f2f]">{trainer.role}</span>
              </div>
            </motion.article>
          ))}
        </section>
      )}

      <section className="mx-auto mt-10 w-full max-w-7xl px-4 sm:mt-14 sm:px-6 lg:mt-16 lg:px-8">
        <div className="relative grid items-center gap-7 overflow-hidden border border-neutral-800 bg-[#1c1b1b] p-5 sm:gap-10 sm:p-8 lg:grid-cols-2 lg:p-10">
          <div className="pointer-events-none absolute right-0 top-0 h-64 w-64 rounded-full bg-[#d32f2f]/10 blur-[100px]" />
          <div>
            <span className="mb-3 block text-[10px] font-bold uppercase tracking-[0.28em] text-[#d32f2f] sm:mb-4 sm:text-xs sm:tracking-[0.3em]">
              The Kovij Standard
            </span>
            <h3 className="mb-4 font-['Lexend'] text-2xl font-black uppercase leading-tight text-white sm:mb-6 sm:text-3xl md:text-4xl">
              Beyond Personal <span className="text-[#f7be1d]">Training.</span> This is Engineering.
            </h3>
            <p className="mb-6 text-sm text-neutral-400 sm:mb-8 sm:text-base lg:text-lg">
              We don&apos;t just count reps. We monitor bio-feedback, optimize movement mechanics, and build psychological resilience.
              Every trainer at Kovij undergoes rigorous internal vetting.
            </p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <FaCheckCircle className="mt-0.5 text-xl text-[#ffb786] sm:text-2xl" />
                <div>
                  <h4 className="text-xs font-bold uppercase text-white">Certified Pro</h4>
                  <p className="text-[10px] text-neutral-500">Tier-1 Global Accredited</p>
                </div>
              </div>
              <div className="flex items-start gap-3 sm:gap-4">
                <FaChartLine className="mt-0.5 text-xl text-[#d32f2f] sm:text-2xl" />
                <div>
                  <h4 className="text-xs font-bold uppercase text-white">Data Driven</h4>
                  <p className="text-[10px] text-neutral-500">Performance Analytics</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="corner-cut-tr group relative flex aspect-video items-center justify-center overflow-hidden border-2 border-neutral-800 bg-neutral-900">
              <img
                src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?q=80&w=2070&auto=format&fit=crop"
                alt="Coaching session"
                className="absolute inset-0 h-full w-full object-cover opacity-60 transition-transform duration-700 group-hover:scale-105"
              />
              <button
                type="button"
                className="fx-hoverlift fx-press relative flex h-12 w-12 items-center justify-center rounded-full bg-[#d32f2f] text-white shadow-lg shadow-[#d32f2f]/30 transition hover:scale-110 sm:h-16 sm:w-16"
                aria-label="Play video"
              >
                <FaPlay className="ml-1 text-base sm:text-xl" />
              </button>
              <span className="absolute bottom-4 left-4 bg-black/50 px-2 py-1 text-[10px] font-bold uppercase text-white">
                Inside the Kovij Academy
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto mt-10 w-full max-w-7xl px-4 sm:mt-12 sm:px-6 lg:px-8">
        <div className="corner-cut-bl relative flex flex-col items-center justify-between gap-6 overflow-hidden bg-[#d32f2f] p-6 sm:gap-8 sm:p-10 md:flex-row md:p-12">
          <span className="pointer-events-none absolute right-0 top-0 select-none font-['Lexend'] text-[200px] font-black italic leading-none tracking-tighter text-black/10">
            KOVIJ
          </span>
          <div className="relative z-10 text-center md:text-left">
            <h3 className="mb-2 font-['Lexend'] text-2xl font-black uppercase italic text-white sm:text-4xl md:text-5xl">
              Find Your <span className="text-black not-italic">Lead</span>
            </h3>
            <p className="kv-body text-white/80">Not sure which trainer fits your mission? Let us match you.</p>
          </div>
          <div className="relative z-10 flex w-full flex-col gap-4 md:w-auto md:flex-row">
            <a
              href="#contact"
              className="corner-cut-tr fx-hoverlift fx-press flex-1 bg-black px-6 py-3 text-center font-['Lexend'] text-xs font-black uppercase tracking-widest text-white transition hover:bg-neutral-900 sm:px-8 sm:py-4 sm:text-sm md:flex-none"
            >
              Book Consult
            </a>
            <a
              href="#contact"
              className="fx-hoverlift fx-press flex-1 border-2 border-white px-6 py-3 text-center font-['Lexend'] text-xs font-black uppercase tracking-widest text-white transition hover:bg-white hover:text-[#d32f2f] sm:px-8 sm:py-4 sm:text-sm md:flex-none"
            >
              Take the Quiz
            </a>
          </div>
        </div>
      </section>
    </section>
  )
}

export default Trainers
