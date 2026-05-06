import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isShopPage = location.pathname === "/shop";

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full border-b-2 border-red-700 backdrop-blur-md transition-colors ${
        scrolled ? "bg-neutral-950/95" : "bg-neutral-950/85"
      }`}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-600/70 to-transparent opacity-70" />
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-['Lexend'] text-2xl font-black italic uppercase tracking-widest text-white">
          <span className="fx-text-shine">KOVIJ FITNESS</span>
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          {isShopPage ? (
            <Link
              to="/"
              className="font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-400 transition-colors duration-200 hover:text-white"
            >
              Home
            </Link>
          ) : (
            [
              { id: "home", label: "Home", active: true },
              { id: "services", label: "Services" },
              { id: "trainers", label: "Trainers" },
              { id: "pricing", label: "Membership" },
            ].map((item) => (
              <motion.a
                key={item.id}
                href={`#${item.id}`}
                className={`fx-underline font-['Lexend'] text-sm font-bold uppercase tracking-tight transition-colors duration-200 ${
                  item.active ? "text-red-600" : "text-neutral-400 hover:text-white"
                }`}
              >
                {item.label}
              </motion.a>
            ))
          )}

          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="fx-underline font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-400 transition-colors duration-200 hover:text-white"
          >
            Shop
          </a>

          <a
            href="#contact"
            className="corner-cut-tr fx-hoverlift fx-press bg-[#d32f2f] px-6 py-2 font-['Lexend'] text-sm font-black uppercase tracking-widest text-white"
          >
            JOIN NOW
          </a>
        </div>

        <button onClick={toggleMenu} className="text-neutral-300 md:hidden" aria-label="Toggle menu">
          {!isOpen ? (
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg className="h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {isOpen && (
        <div className="border-t border-neutral-800 bg-neutral-950 px-6 pb-5 pt-3 md:hidden">
          <div className="space-y-2">
            {isShopPage ? (
              <Link
                to="/"
                onClick={closeMenu}
                className="block py-2 font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-300"
              >
                Home
              </Link>
            ) : (
              [
                { id: "home", label: "Home" },
                { id: "services", label: "Services" },
                { id: "trainers", label: "Trainers" },
                { id: "pricing", label: "Membership" },
                { id: "contact", label: "Contact" },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={closeMenu}
                  className="block py-2 font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-300"
                >
                  {item.label}
                </a>
              ))
            )}

            <a
              href="/shop"
              target="_blank"
              rel="noopener noreferrer"
              onClick={closeMenu}
              className="block py-2 font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-300"
            >
              Shop
            </a>

            <a
              href="#contact"
              onClick={closeMenu}
              className="mt-2 inline-block bg-[#d32f2f] px-4 py-2 font-['Lexend'] text-xs font-bold uppercase tracking-wider text-white"
            >
              Join Now
            </a>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
