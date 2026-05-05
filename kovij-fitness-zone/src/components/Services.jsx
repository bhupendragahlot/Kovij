import { motion } from "framer-motion";
import { FaArrowRight, FaBolt, FaCheckCircle, FaDumbbell, FaUsers } from "react-icons/fa";

function Services() {
  return (
    <section id="services" className="bg-[#131313] text-[#e5e2e1]">
      <section className="px-6 pb-8 pt-20 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 14 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4 }}
          className="font-['Lexend'] text-4xl font-extrabold uppercase italic text-white md:text-5xl"
        >
          OVER SERVICES
        </motion.h2>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-12">
          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="group relative overflow-hidden border border-[#5b403d] bg-[#1c1b1b] md:col-span-8"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-[#d32f2f]" />
            <div className="flex h-full flex-col md:flex-row">
              <div className="flex-1 p-8">
                <div className="mb-4 flex items-center gap-2">
                  <FaDumbbell className="text-[#d32f2f]" />
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#d32f2f]">Tier 01</span>
                </div>
                <h3 className="mb-4 font-['Lexend'] text-4xl font-black uppercase">Strength & Conditioning</h3>
                <p className="mb-6 text-[#e4beba]">
                  Forge an unbreakable foundation. Our strength program utilizes progressive overload and olympic lifting techniques to maximize muscular power and metabolic efficiency.
                </p>
                <div className="mb-8 grid grid-cols-2 gap-3 text-sm">
                  {["Olympic Lifting", "Powerlifting Core", "Hypertrophy Focus", "Mobility Prep"].map((point) => (
                    <div key={point} className="flex items-center gap-2 text-[#e5e2e1]">
                      <FaCheckCircle className="text-[#f7be1d]" /> {point}
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-6">
                  <button className="corner-cut-tr bg-[#d32f2f] px-8 py-3 text-xs font-black uppercase tracking-[0.16em] text-white hover:bg-[#930010]">
                    Book a Trial
                  </button>
                  <div>
                    <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#ab8985]">Schedule</span>
                    <span className="text-sm font-bold uppercase">Mon - Fri: 05:00 - 21:00</span>
                  </div>
                </div>
              </div>
              <div className="relative min-h-[300px] md:w-1/3">
                <img
                  src="https://images.unsplash.com/photo-1517836357463-d25dfeac3438?q=80&w=1974&auto=format&fit=crop"
                  alt="Strength training"
                  className="h-full w-full object-cover grayscale brightness-75 transition-all duration-500 group-hover:grayscale-0"
                />
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="relative border border-[#5b403d] bg-[#1c1b1b] md:col-span-4"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-[#f27a00]" />
            <div className="flex h-full flex-col p-8">
              <div className="mb-4 flex items-center gap-2">
                <FaBolt className="text-[#f27a00]" />
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#f27a00]">Tier 02</span>
              </div>
              <h3 className="mb-4 font-['Lexend'] text-4xl font-black uppercase">HIIT & Cardio</h3>
              <p className="mb-8 text-[#e4beba]">
                High-octane interval training designed to push your VO2 max to the limit. Precision monitoring ensures you stay in the burn zone.
              </p>
              <div className="mb-7 space-y-4">
                <div className="border-l-2 border-[#f27a00] bg-[#201f1f] p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#f27a00]">Benefit</span>
                  <span className="text-sm font-bold text-white">12% Metabolic Afterburn Peak</span>
                </div>
                <div className="border-l-2 border-[#f27a00] bg-[#201f1f] p-3">
                  <span className="block text-[10px] font-bold uppercase tracking-[0.16em] text-[#f27a00]">Tech</span>
                  <span className="text-sm font-bold text-white">Live Heart-Rate Integration</span>
                </div>
              </div>
              <button className="corner-cut-bl mt-auto w-full border-2 border-[#f27a00] py-3 text-xs font-black uppercase tracking-[0.16em] text-[#f27a00] transition hover:bg-[#f27a00] hover:text-white">
                Book a Trial
              </button>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="relative overflow-hidden border border-[#5b403d] bg-[#1c1b1b] md:col-span-6"
          >
            <div className="absolute left-0 top-0 h-full w-1 bg-[#f7be1d]" />
            <div className="flex h-full flex-col sm:flex-row">
              <div className="relative min-h-[250px] sm:w-1/2">
                <img
                  src="https://images.unsplash.com/photo-1506126613408-eca07ce68773?q=80&w=2070&auto=format&fit=crop"
                  alt="Yoga flow"
                  className="h-full w-full object-cover opacity-60"
                />
              </div>
              <div className="p-8 sm:w-1/2">
                <div className="mb-4 flex items-center gap-2">
                  <FaCheckCircle className="text-[#f7be1d]" />
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#f7be1d]">Tier 03</span>
                </div>
                <h3 className="mb-4 font-['Lexend'] text-4xl font-black uppercase">Yoga & Flow</h3>
                <p className="mb-6 text-[#e4beba]">
                  Active recovery and mental resilience. Our combat yoga focuses on mobility and core stability for high-impact athletes.
                </p>
                <button className="corner-cut-tr bg-[#f7be1d] px-8 py-3 text-xs font-black uppercase tracking-[0.16em] text-black hover:bg-yellow-500">
                  Book a Trial
                </button>
              </div>
            </div>
          </motion.article>

          <motion.article
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.08 }}
            className="relative flex items-center overflow-hidden border border-red-900/30 bg-neutral-900 p-8 md:col-span-6"
          >
            <div className="absolute right-4 top-4 text-7xl text-red-900/20">
              <FaUsers />
            </div>
            <div className="relative z-10 max-w-md">
              <h3 className="mb-2 font-['Lexend'] text-3xl font-black uppercase">1-on-1 Elite Coaching</h3>
              <p className="mb-6 text-[#e4beba]">Customized mechanical analysis and nutritional engineering from pro-level trainers.</p>
              <div className="flex gap-4">
                <div className="flex -space-x-3">
                  <div className="h-10 w-10 rounded-full border-2 border-[#131313] bg-[#393939]" />
                  <div className="h-10 w-10 rounded-full border-2 border-[#131313] bg-[#2a2a2a]" />
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-[#131313] bg-[#d32f2f] text-[10px] font-bold">
                    12+
                  </div>
                </div>
                <div className="self-center text-xs">
                  <span className="block font-bold uppercase tracking-tight text-white">Elite Coaches</span>
                  <span className="text-[10px] uppercase text-[#ab8985]">Ready for booking</span>
                </div>
              </div>
            </div>
            <FaArrowRight className="ml-auto text-2xl text-[#d32f2f]" />
          </motion.article>
        </div>
      </section>

      <section className="border-y border-neutral-900 bg-[#0e0e0e] py-12">
        <div className="mx-auto max-w-7xl overflow-x-auto px-6">
          <div className="flex min-w-[800px] items-center justify-between gap-8">
            {[
              ["40+", "Weekly HIIT Sessions", "#d32f2f"],
              ["12", "Certified Master Trainers", "#f27a00"],
              ["10k", "Sq Ft Performance Zone", "#f7be1d"],
              ["24/7", "Member Facility Access", "#ffffff"],
            ].map((stat, idx) => (
              <div key={stat[1]} className="flex items-center gap-8">
                <div className="flex flex-col">
                  <span className="font-['Lexend'] text-5xl font-black" style={{ color: stat[2] }}>
                    {stat[0]}
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.16em] text-[#ab8985]">{stat[1]}</span>
                </div>
                {idx !== 3 && <div className="h-12 w-px bg-neutral-800" />}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16 text-center">
        <h3 className="mb-8 text-xs font-bold uppercase tracking-[0.2em] text-[#ffb3ac]">Explore Muscle Group Targets</h3>
        <div className="flex flex-wrap justify-center gap-4">
          {["Posterior Chain", "Core Stability", "Explosive Power", "Mobility Flow", "Metabolic Conditioning", "Hypertrophy"].map(
            (chip) => (
              <span
                key={chip}
                className="cursor-pointer border border-[#5b403d] bg-[#2a2a2a] px-6 py-2 text-xs font-bold uppercase tracking-[0.12em] text-[#e5e2e1] transition-colors hover:bg-[#d32f2f] hover:text-white"
              >
                {chip}
              </span>
            )
          )}
        </div>
      </section>
    </section>
  );
}

export default Services;
