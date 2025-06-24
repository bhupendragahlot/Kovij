import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../context/ThemeContext';

function Hero() {
  const [text, setText] = useState('');
  const [settings, setSettings] = useState(null);
  const [index, setIndex] = useState(0);
  const { theme } = useTheme();

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

  return (
    <section id="home" className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Background image with overlay */}
      <div className="absolute inset-0 z-0">
        <img 
          src={settings?.heroBackgroundImage || "https://c1.wallpaperflare.com/preview/497/845/200/gym-strong-fitness-athlete.jpg"} 
          alt="Gym background" 
          className="w-full h-full object-cover"
        />
        <div className={`absolute inset-0 ${theme === 'dark' ? 'bg-black/60' : 'bg-black/40'}`}></div>
      </div>
      {/* Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold mb-6">
            <span className="block text-white">WELCOME TO</span>
            <span className="block text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-yellow-500 mt-2">
              KOVIJ FITNESS ZONE
            </span>
          </h1>
          <h2 className="text-xl sm:text-2xl md:text-3xl font-bold text-white mb-8 h-12">
            {text}
            <span className="animate-blink">|</span>
          </h2>
          <p className="text-gray-300 text-lg md:text-xl max-w-3xl mx-auto mb-10">
            {settings?.heroDescription || "Achieve your fitness goals with state-of-the-art equipment, expert trainers, and a motivating environment."}
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <motion.a 
              href="#contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold rounded-full shadow-lg hover:shadow-red-500/30 transition-all duration-300"
            >
              JOIN NOW
            </motion.a>
            <motion.a 
              href="#services"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="px-8 py-3 bg-transparent border-2 border-white text-white font-bold rounded-full shadow-lg hover:bg-white/10 transition-all duration-300"
            >
              EXPLORE
            </motion.a>
          </div>
        </motion.div>
      </div>
      {/* Scroll down indicator */}
      <div className="absolute bottom-10 left-1/2 transform -translate-x-1/2 animate-bounce">
        <a href="#services" className="text-white">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </a>
      </div>
    </section>
  );
}

export default Hero;
