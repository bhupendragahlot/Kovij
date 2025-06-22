//src/app.jsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import { useTheme } from "./context/ThemeContext";
import ScrollToTop from "./components/ScrollToTop";
import Adminlogin from "./components/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import DashboardHome from "./pages/admin/DashboardHome";
import TrainersList from "./pages/admin/Trainers/TrainersList";
import TrainerForm from "./pages/admin/Trainers/TrainerForm";
import PlansList from "./pages/admin/Plans/PlansList";
import PlanForm from "./pages/admin/Plans/PlanForm";
import ProductsList from "./pages/admin/Products/ProductsList";
import ProductForm from "./pages/admin/Products/ProductForm";
import AdminSidebar from "./components/admin/AdminSidebar";
import AdminAnalytics from "./pages/admin/Analytics";
import AdminSettings from "./pages/admin/Settings";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  const { theme } = useTheme();

  useEffect(() => {
    // Smooth scroll behavior for the entire app
    document.documentElement.style.scrollBehavior = "smooth";

    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  return (
    <Router>
      <Routes>
        <Route
          path="/*"
          element={
            <>
              <ScrollToTop />
              <div
                className={`font-poppins ${
                  theme === "dark"
                    ? "bg-gradient-to-b from-gray-900 to-black"
                    : "bg-gradient-to-b from-gray-100 to-white"
                } min-h-screen ${
                  theme === "dark" ? "text-white" : "text-gray-900"
                }`}
              >
                <Navbar />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/shop" element={<Shop />} />
                </Routes>
                <Footer />
              </div>
            </>
          }
        />

        <Route path="/admin/login" element={<Adminlogin />} />

        {/* Protected Admin Routes */}
        <Route element={<ProtectedRoute />}>
          <Route path="/admin/*" element={<AdminDashboard />}>
            <Route path="dashboard" element={<DashboardHome />} />
            <Route path="trainers" element={<TrainersList />} />
            <Route path="trainers/new" element={<TrainerForm />} />
            <Route path="trainers/edit/:id" element={<TrainerForm />} />
            <Route path="plans" element={<PlansList />} />
            <Route path="plans/new" element={<PlanForm />} />
            <Route path="plans/edit/:id" element={<PlanForm />} />
            <Route path="products" element={<ProductsList />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/edit/:id" element={<ProductForm />} />
            <Route path="analytics" element={<AdminAnalytics />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>
      </Routes>
    </Router>
  );
}

export default App;
