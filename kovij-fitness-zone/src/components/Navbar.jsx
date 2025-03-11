import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { FaDumbbell, FaMoon, FaSun } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 50) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const toggleMenu = () => {
    setIsOpen(!isOpen);
  };

  const closeMenu = () => {
    setIsOpen(false);
  };

  return (
    <nav className={`fixed w-full z-50 transition-all duration-300 ${
      scrolled 
        ? theme === 'dark' 
          ? 'bg-black/80 backdrop-blur-md' 
          : 'bg-white/80 backdrop-blur-md' 
        : 'bg-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          <div className="flex items-center">
            <Link to="/" className="flex items-center">
              <FaDumbbell className="h-8 w-8 text-red-500" />
              <span className={`ml-2 text-xl font-bold bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent`}>
                KOVIJ FITNESS ZONE
              </span>
            </Link>
          </div>
          
          {/* Desktop menu */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-center space-x-4">
              <a href="#home" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Home</a>
              <a href="#services" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Services</a>
              <a href="#gallery" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Gallery</a>
              <a href="#trainers" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Trainers</a>
              <a href="#pricing" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Pricing</a>
              <a href="#contact" className={`hover:text-red-500 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-300 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>Contact</a>
              <a href="/shop" target="_blank" rel="noopener noreferrer" className="bg-gradient-to-r from-red-600 to-red-500 text-white px-4 py-2 rounded-md text-sm font-medium hover:from-red-700 hover:to-red-600 transition-all duration-300 transform hover:scale-105">Shop</a>
              
              {/* Theme toggle button */}
              <button 
                onClick={toggleTheme} 
                className={`p-2 rounded-full ${theme === 'dark' ? 'bg-gray-800 text-yellow-300' : 'bg-gray-200 text-gray-800'} hover:bg-opacity-80 transition-colors duration-300`}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {theme === 'dark' ? <FaSun className="h-5 w-5" /> : <FaMoon className="h-5 w-5" />}
              </button>
            </div>
          </div>
          
          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            {/* Theme toggle button for mobile */}
            <button 
              onClick={toggleTheme} 
              className={`p-2 mr-2 rounded-full ${theme === 'dark' ? 'bg-gray-800 text-yellow-300' : 'bg-gray-200 text-gray-800'} hover:bg-opacity-80 transition-colors duration-300`}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <FaSun className="h-5 w-5" /> : <FaMoon className="h-5 w-5" />}
            </button>
            
            <button
              onClick={toggleMenu}
              className={`inline-flex items-center justify-center p-2 rounded-md ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'} focus:outline-none`}
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {!isOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden ${isOpen ? 'block' : 'hidden'}`}>
        <div className={`px-2 pt-2 pb-3 space-y-1 sm:px-3 ${theme === 'dark' ? 'bg-black/90 backdrop-blur-md' : 'bg-white/90 backdrop-blur-md'}`}>
          <a href="#home" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Home</a>
          <a href="#services" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Services</a>
          <a href="#gallery" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Gallery</a>
          <a href="#trainers" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Trainers</a>
          <a href="#pricing" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Pricing</a>
          <a href="#contact" onClick={closeMenu} className={`hover:bg-gray-800 block px-3 py-2 rounded-md text-base font-medium ${theme === 'dark' ? 'text-white hover:bg-gray-700' : 'text-gray-800 hover:bg-gray-200'}`}>Contact</a>
          <a href="/shop" target="_blank" rel="noopener noreferrer" onClick={closeMenu} className="bg-gradient-to-r from-red-600 to-red-500 block px-3 py-2 rounded-md text-base font-medium text-white">Shop</a>
        </div>
      </div>
    </nav>
  );
}

export default Navbar;
