import { FaDumbbell, FaFacebook, FaInstagram, FaWhatsapp, FaEnvelope, FaPhone, FaMapMarkerAlt } from 'react-icons/fa';
import { useTheme } from '../context/ThemeContext';

function Footer() {
  const currentYear = new Date().getFullYear();
  const { theme } = useTheme();
  
  return (
    <footer className={theme === 'dark' ? 'bg-black text-white' : 'bg-gray-100 text-gray-900'}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* About */}
          <div>
            <div className="flex items-center mb-4">
              <FaDumbbell className="h-8 w-8 text-red-500" />
              <span className="ml-2 text-xl font-bold bg-gradient-to-r from-red-500 to-yellow-500 bg-clip-text text-transparent">
                KOVIJ FITNESS
              </span>
            </div>
            <p className={`${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'} mb-4`}>
              Transforming lives through fitness since 2015. Our state-of-the-art facility is designed to help you achieve your fitness goals.
            </p>
            <div className="flex space-x-4">
              <a 
                href="https://facebook.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${theme === 'dark' ? 'text-gray-400 hover:text-blue-500' : 'text-gray-600 hover:text-blue-500'} transition-colors duration-300`}
              >
                <FaFacebook className="text-xl" />
              </a>
              <a 
                href="https://instagram.com" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${theme === 'dark' ? 'text-gray-400 hover:text-pink-500' : 'text-gray-600 hover:text-pink-500'} transition-colors duration-300`}
              >
                <FaInstagram className="text-xl" />
              </a>
              <a 
                href="https://wa.me/919876543210" 
                target="_blank" 
                rel="noopener noreferrer"
                className={`${theme === 'dark' ? 'text-gray-400 hover:text-green-500' : 'text-gray-600 hover:text-green-500'} transition-colors duration-300`}
              >
                <FaWhatsapp className="text-xl" />
              </a>
            </div>
          </div>
          
          {/* Quick Links */}
          <div>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <a href="#home" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Home</a>
              </li>
              <li>
                <a href="#services" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Services</a>
              </li>
              <li>
                <a href="#gallery" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Gallery</a>
              </li>
              <li>
                <a href="#trainers" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Trainers</a>
              </li>
              <li>
                <a href="#pricing" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Pricing</a>
              </li>
              <li>
                <a href="#contact" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Contact</a>
              </li>
              <li>
                <a href="/shop" target="_blank" rel="noopener noreferrer" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>Shop</a>
              </li>
            </ul>
          </div>
          
          {/* Contact Info */}
          <div>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Contact Info</h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <FaMapMarkerAlt className="text-red-500 mt-1 mr-2" />
                <a 
                  href="https://maps.app.goo.gl/v99oCZ1vtRpuXTB66" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}
                >
                  120 Feet Rd, Chitresh Nagar, Manpura, Naya Nohra, Rajasthan 324004
                </a>
              </li>
              <li className="flex items-center">
                <FaPhone className="text-red-500 mr-2" />
                <a href="tel:+919876543210" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>
                  +91 98765 43210
                </a>
              </li>
              <li className="flex items-center">
                <FaEnvelope className="text-red-500 mr-2" />
                <a href="mailto:info@kovijfitness.com" className={`${theme === 'dark' ? 'text-gray-400 hover:text-red-400' : 'text-gray-600 hover:text-red-500'} transition-colors duration-300`}>
                  info@kovijfitness.com
                </a>
              </li>
            </ul>
          </div>
          
          {/* Opening Hours */}
          <div>
            <h3 className={`text-lg font-bold mb-4 ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>Opening Hours</h3>
            <ul className="space-y-2">
              <li className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monday - Saturday</span>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>6-11 AM</span>
              </li>
              <li className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Monday - Saturday</span>
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>4-9 PM</span>
              </li>
              <li className="flex justify-between">
                <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>Sunday</span>
                <span className="text-red-400">Closed</span>
              </li>
            </ul>
          </div>
        </div>
        
        <div className={`border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-300'} mt-12 pt-8 text-center`}>
          <p className={theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}>
            &copy; {currentYear} Kovij Fitness Zone. All rights reserved. Developed by <a href="mailto:bhupendragahlot11@gmail.com" className={`${theme === 'dark' ? 'text-gray-400 hover:text-blue-500' : 'text-gray-600 hover:text-blue-500'} transition-colors duration-300`}>BhupendraGahlot</a>
          </p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;
