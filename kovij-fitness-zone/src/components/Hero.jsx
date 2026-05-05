import { motion } from "framer-motion";

function Hero() {
  return (
    <section id="home" className="relative mt-[72px] flex h-[921px] items-center overflow-hidden">
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1534438327276-14e5300c3a48?q=80&w=1974&auto=format&fit=crop"
          alt="Intense gym hero background"
          className="h-full w-full object-cover grayscale opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#131313] via-[#131313]/80 to-transparent" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-7xl px-6"
      >
        <div className="max-w-2xl">
          <span className="mb-6 inline-block bg-[#d32f2f] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#fff2f0]">
            EST. 2024
          </span>

          <h1 className="mb-6 font-['Lexend'] text-[48px] font-extrabold uppercase leading-none md:text-[72px]">
            FORGE YOUR <br />
            <span className="text-stroke-red block text-8xl md:inline">ULTIMATE</span> <br />
            SELF
          </h1>

          <p className="mb-8 max-w-md text-lg text-[#e4beba]">
            Elite equipment, uncompromising coaching, and a community built on discipline. Stop wishing. Start engineering.
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#contact"
              className="corner-cut-tr bg-[#d32f2f] px-10 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#930010]"
            >
              START TRAINING
            </a>
            <a
              href="#pricing"
              className="corner-cut-bl border-2 border-[#f27a00] px-10 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#f27a00] transition-colors hover:bg-[#f27a00]/10"
            >
              VIEW PLANS
            </a>
          </div>
        </div>
      </motion.div>

      <div className="absolute bottom-0 right-0 hidden p-12 lg:block">
        <div className="origin-right rotate-90 select-none font-['Lexend'] text-9xl font-black uppercase text-[#353534] opacity-20">
          INTENSITY
        </div>
      </div>
    </section>
  );
}

export default Hero;
