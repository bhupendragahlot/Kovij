import { useState } from "react";
import { Link } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { motion } from "framer-motion";

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();
  const isShopPage = location.pathname === "/shop";

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className="fixed top-0 z-50 w-full border-b-2 border-red-700 bg-neutral-950/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="font-['Lexend'] text-2xl font-black italic uppercase tracking-widest text-white">
          KOVIJ FITNESS
        </Link>

        <div className="hidden items-center space-x-8 md:flex">
          {isShopPage && (
            <Link
              to="/"
              className="font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-400 transition-colors duration-200 hover:text-white"
            >
              Home
            </Link>
          )}
          {!isShopPage &&
            [
              { id: "home", label: "Home", active: true },
              { id: "services", label: "Services" },
              { id: "trainers", label: "Trainers" },
              { id: "pricing", label: "Membership" },
            ].map((item) => (
                <motion.a
                  key={item.id}
                  href={`#${item.id}`}
                  className={`font-['Lexend'] text-sm font-bold uppercase tracking-tight transition-colors duration-200 ${
                    item.active
                      ? "border-b-2 border-red-600 pb-1 text-red-600"
                      : "text-neutral-400 hover:text-white"
                  }`}
                >
                  {item.label}
                </motion.a>
            ))}
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-400 transition-colors duration-200 hover:text-white"
          >
            Shop
          </a>
          <a
            href="#contact"
            className="corner-cut-tr bg-[#d32f2f] px-6 py-2 font-['Lexend'] text-sm font-black uppercase tracking-widest text-white transition-transform duration-100 ease-in-out active:scale-95"
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

      {isOpen && (
        <div className="border-t border-neutral-800 bg-neutral-950 px-6 pb-5 pt-3 md:hidden">
          <div className="space-y-2">
            {isShopPage && (
              <Link
                to="/"
                onClick={closeMenu}
                className="block py-2 font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-300"
              >
                Home
              </Link>
            )}
            {!isShopPage &&
              [
                { id: "home", label: "Home" },
                { id: "services", label: "Services" },
                { id: "trainers", label: "Trainers" },
                { id: "pricing", label: "Membership" },
                { id: "contact", label: "Contact" },
              ].map((item) => (
            <motion.a
              key={item.id}
              href={`#${item.id}`}
              onClick={closeMenu}
              className="block py-2 font-['Lexend'] text-sm font-bold uppercase tracking-tight text-neutral-300"
            >
              {item.label}
            </motion.a>
              ))}
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
