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
import MemberProtectedRoute from "./components/MemberProtectedRoute";
import { MemberAuthProvider } from "./context/MemberAuthContext";
import MemberLogin from "./pages/member/Login";
import JoinGymForm from "./pages/member/JoinGymForm";
import MemberDashboard from "./pages/member/Dashboard";
import MyMembership from "./pages/member/MyMembership";
import Payments from "./pages/member/Payments";
import MemberProfile from "./pages/member/Profile";
import MemberLayout from "./pages/member/MemberLayout";
import AccountHub from "./pages/member/AccountHub";
import AccountAddresses from "./pages/member/AccountAddresses";
import AccountSettings from "./pages/member/AccountSettings";
import AccountMembershipHistory from "./pages/member/AccountMembershipHistory";
import MembersList from "./pages/admin/Members/MembersList";
import MemberDetail from "./pages/admin/Members/MemberDetail";
import Campaigns from "./pages/admin/Email/Campaigns";
import BillSender from "./pages/admin/Email/BillSender";

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
    <MemberAuthProvider>
    <Router>
      <Routes>
        {/* Member area (dashboard-like, separate from marketing site) */}
        <Route path="/member/*" element={<MemberLayout />}>
          <Route path="login" element={<MemberLogin />} />
          <Route path="join" element={<JoinGymForm />} />
          <Route element={<MemberProtectedRoute />}>
            <Route path="dashboard" element={<MemberDashboard />} />
            <Route path="join/form" element={<JoinGymForm />} />
            <Route path="membership" element={<MyMembership />} />
            <Route path="payments" element={<Payments />} />
            <Route path="profile" element={<MemberProfile />} />
            <Route path="account" element={<AccountHub />} />
            <Route path="account/addresses" element={<AccountAddresses />} />
            <Route path="account/membership-history" element={<AccountMembershipHistory />} />
            <Route path="account/settings" element={<AccountSettings />} />
          </Route>
        </Route>

        {/* Marketing site (with Navbar + Footer) */}
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
            <Route path="members" element={<MembersList />} />
            <Route path="members/:id" element={<MemberDetail />} />
            <Route path="email/campaigns" element={<Campaigns />} />
            <Route path="email/bill" element={<BillSender />} />
          </Route>
        </Route>
      </Routes>
    </Router>
    </MemberAuthProvider>
  );
}

export default App;
