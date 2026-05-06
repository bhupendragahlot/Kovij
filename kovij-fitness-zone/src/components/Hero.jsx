import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { animate, stagger } from "motion";
import { useTheme } from "../context/ThemeContext";

function Hero() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState(null);
  const [index, setIndex] = useState(0);
  const { theme } = useTheme();
  const heroTextRef = useRef(null);

  // Fetch settings from backend
  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data))
      .catch(() => setSettings(null));
  }, []);

  // Use fetched headline or fallback
  const fullText = settings?.heroHeadline || "TRANSFORM YOUR BODY, TRANSFORM YOUR LIFE";

  useEffect(() => {
    if (index < fullText.length) {
      const timeout = setTimeout(() => {
        setText(prevText => prevText + fullText[index]);
        setIndex(prevIndex => prevIndex + 1);
      }, 100);
      return () => clearTimeout(timeout);
    }
  }, [index, fullText]);

  useEffect(() => {
    const el = heroTextRef.current;
    if (!el) return;

    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;

    const targets = el.querySelectorAll("[data-hero-reveal]");
    if (!targets.length) return;

    const controls = animate(
      targets,
      { opacity: [0, 1], y: [12, 0], filter: ["blur(8px)", "blur(0px)"] },
      { duration: 0.55, delay: stagger(0.05), easing: "ease-out" }
    );

    return () => controls?.cancel?.();
  }, [settings?.heroHeadline]);

  return (
    <section id="home" className="relative mt-[72px] flex h-[921px] items-center overflow-hidden bg-[#131313] text-[#e5e2e1]">
      <div className="absolute inset-0 z-0">
        <img
          src={settings?.heroBackgroundImage || "https://c1.wallpaperflare.com/preview/497/845/200/gym-strong-fitness-athlete.jpg"}
          alt="Gym background"
          className="fx-kenburns fx-gpu h-full w-full object-cover grayscale opacity-40"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#131313] via-[#131313]/80 to-transparent" />
        <div className="grid-noise fx-noise-drift absolute inset-0 opacity-45" />
        <div className={`absolute inset-0 ${theme === "dark" ? "bg-black/15" : "bg-black/20"}`} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 28 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.7, ease: "easeOut" }}
        className="relative z-10 mx-auto w-full max-w-7xl px-6"
      >
        <div ref={heroTextRef} className="max-w-2xl">
          <span className="mb-6 inline-block bg-[#d32f2f] px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-[#fff2f0]">
            EST. 2024
          </span>

          <h1 data-hero-reveal className="mb-6 font-['Lexend'] text-[48px] font-extrabold uppercase leading-none md:text-[72px]">
            FORGE YOUR <br />
            <span className="text-stroke-red block text-8xl md:inline">ULTIMATE</span> <br />
            SELF
          </h1>

          <h2 data-hero-reveal className="mb-4 h-10 text-lg font-bold uppercase tracking-wide text-[#e4beba] md:h-12 md:text-xl">
            {text}
            <span className="animate-blink">|</span>
          </h2>

          <p data-hero-reveal className="mb-8 max-w-md text-lg text-[#e4beba]">
            {settings?.heroDescription ||
              "Achieve your fitness goals with state-of-the-art equipment, expert trainers, and a motivating environment."}
          </p>

          <div className="flex flex-wrap gap-4">
            <a
              href="#contact"
              className="corner-cut-tr fx-hoverlift fx-press bg-[#d32f2f] px-10 py-4 text-sm font-bold uppercase tracking-[0.16em] text-white transition-colors hover:bg-[#930010]"
            >
              START TRAINING
            </a>
            <a
              href="#services"
              className="corner-cut-bl fx-hoverlift fx-press border-2 border-[#f27a00] px-10 py-4 text-sm font-bold uppercase tracking-[0.16em] text-[#f27a00] transition-colors hover:bg-[#f27a00]/10"
            >
              EXPLORE
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
