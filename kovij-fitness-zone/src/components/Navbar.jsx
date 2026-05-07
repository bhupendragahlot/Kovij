import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [lastScrollY, setLastScrollY] = useState(0);
  const location = useLocation();
  const isShopPage = location.pathname === "/shop";

  useEffect(() => {
    const handleScroll = () => {
      const currentY = window.scrollY || 0;

      if (currentY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }

      // Hide on scroll down, show on scroll up (with a small threshold to avoid jitter)
      const delta = currentY - lastScrollY;
      const isAtTop = currentY < 20;
      if (isOpen) {
        setHidden(false);
      } else if (isAtTop) {
        setHidden(false);
      } else if (Math.abs(delta) > 8) {
        setHidden(delta > 0);
      }

      setLastScrollY(currentY);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isOpen, lastScrollY]);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav
      className={`fixed top-0 z-50 w-full border-b-2 border-red-700 backdrop-blur-md transition-[transform,background-color] duration-200 ${
        scrolled ? "bg-neutral-950/95" : "bg-neutral-950/85"
      } ${hidden ? "-translate-y-full" : "translate-y-0"}`}
    >
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-red-600/70 to-transparent opacity-70" />
      <div className="kv-container flex items-center justify-between py-2 sm:py-4">
        <Link
          to="/"
          className="font-['Lexend'] text-base font-black italic uppercase tracking-widest text-white sm:text-2xl"
          aria-label="Kovij Fitness Home"
        >
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

          <Link
            to="/member/join"
            className="corner-cut-tr fx-hoverlift fx-press bg-[#d32f2f] px-6 py-2 font-['Lexend'] text-sm font-black uppercase tracking-widest text-white"
          >
            JOIN NOW
          </Link>
        </div>

        <button
          onClick={toggleMenu}
          className="fx-hoverlift fx-press flex h-10 w-10 items-center justify-center border border-neutral-800 bg-neutral-950/40 text-neutral-200 md:hidden"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
          aria-controls="mobile-nav"
          type="button"
        >
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
        <div id="mobile-nav" className="border-t border-neutral-800 bg-neutral-950 md:hidden">
          <div className="kv-container pb-5 pt-3">
            <div className="space-y-2">
            {isShopPage ? (
              <Link
                to="/"
                onClick={closeMenu}
                className="block rounded-md border border-neutral-900 bg-black/20 px-4 py-3 font-['Lexend'] text-xs font-bold uppercase tracking-widest text-neutral-200 transition hover:border-red-600/60"
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
                  className="block rounded-md border border-neutral-900 bg-black/20 px-4 py-3 font-['Lexend'] text-xs font-bold uppercase tracking-widest text-neutral-200 transition hover:border-red-600/60"
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
              className="block rounded-md border border-neutral-900 bg-black/20 px-4 py-3 font-['Lexend'] text-xs font-bold uppercase tracking-widest text-neutral-200 transition hover:border-red-600/60"
            >
              Shop
            </a>

            <Link
              to="/member/join"
              onClick={closeMenu}
              className="corner-cut-tr fx-hoverlift fx-press mt-2 inline-flex w-full items-center justify-center bg-[#d32f2f] px-4 py-3 font-['Lexend'] text-xs font-black uppercase tracking-widest text-white"
            >
              Join Now
            </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
