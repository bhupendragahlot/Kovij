import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { useEffect } from 'react';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Home from './pages/Home';
import Shop from './pages/Shop';
import { useTheme } from './context/ThemeContext';

function App() {
  const { theme } = useTheme();
  
  useEffect(() => {
    // Smooth scroll behavior for the entire app
    document.documentElement.style.scrollBehavior = 'smooth';
    
    return () => {
      document.documentElement.style.scrollBehavior = 'auto';
    };
  }, []);

  return (
    <Router>
      <div className={`font-poppins ${theme === 'dark' ? 'bg-gradient-to-b from-gray-900 to-black' : 'bg-gradient-to-b from-gray-100 to-white'} min-h-screen ${theme === 'dark' ? 'text-white' : 'text-gray-900'}`}>
        <Navbar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
        </Routes>
        <Footer />
      </div>
    </Router>
  );
}

export default App;
