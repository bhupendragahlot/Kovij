import { Outlet } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ScrollToTop from "../components/ScrollToTop";
import { useTheme } from "../context/ThemeContext";

/** Public website chrome (navbar + footer) around Home and Shop. */
export default function MarketingLayout() {
  const { theme } = useTheme();
  return (
    <>
      <ScrollToTop />
      <div
        className={`font-poppins min-h-screen ${
          theme === "dark" ? "bg-gradient-to-b from-gray-900 to-black text-white" : "bg-gradient-to-b from-gray-100 to-white text-gray-900"
        }`}
      >
        <Navbar />
        <Outlet />
        <Footer />
      </div>
    </>
  );
}
