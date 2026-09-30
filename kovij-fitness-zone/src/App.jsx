import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider } from "react-router-dom";
import MarketingLayout from "./layouts/MarketingLayout";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import MemberProtectedRoute from "./components/MemberProtectedRoute";
import MemberLayout from "./pages/member/MemberLayout";
import MemberLogin from "./pages/member/Login";
import JoinGymForm from "./pages/member/JoinGymForm";
import MemberDashboard from "./pages/member/Dashboard";
import MyMembership from "./pages/member/MyMembership";
import Payments from "./pages/member/Payments";
import MemberProfile from "./pages/member/Profile";
import AccountHub from "./pages/member/AccountHub";
import AccountAddresses from "./pages/member/AccountAddresses";
import AccountSettings from "./pages/member/AccountSettings";
import AccountMembershipHistory from "./pages/member/AccountMembershipHistory";
import { MemberAuthProvider } from "./context/MemberAuthContext";
import { RequireStaff } from "./features/auth/RequireStaff";
import { ConfirmProvider } from "./shared/ui/ConfirmProvider";

// The staff app is loaded only when someone opens /admin, so the public site stays light.
const CrmLayout = lazy(() => import("./layouts/crm/CrmLayout"));
const StaffLoginPage = lazy(() => import("./features/auth/StaffLoginPage"));
const DashboardPage = lazy(() => import("./features/dashboard/DashboardPage"));
const MembersPage = lazy(() => import("./features/members/MembersPage"));
const NewMemberPage = lazy(() => import("./features/members/NewMemberPage"));
const MemberProfilePage = lazy(() => import("./features/members/MemberProfilePage"));
const CheckInPage = lazy(() => import("./features/attendance/CheckInPage"));
const PaymentsPage = lazy(() => import("./features/payments/PaymentsPage"));
const LeadsPage = lazy(() => import("./features/leads/LeadsPage"));
const PlansPage = lazy(() => import("./features/catalog/PlansPage"));
const TrainersPage = lazy(() => import("./features/catalog/TrainersPage"));
const CampaignsPage = lazy(() => import("./features/campaigns/CampaignsPage"));
const SettingsPage = lazy(() => import("./features/settings/SettingsPage"));
const NotFoundPage = lazy(() => import("./layouts/crm/NotFoundPage"));

const staffShell = (
  <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
    <ConfirmProvider>
      <RequireStaff>
        <CrmLayout />
      </RequireStaff>
    </ConfirmProvider>
  </Suspense>
);

const router = createBrowserRouter([
  {
    path: "/admin/login",
    element: (
      <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>
        <StaffLoginPage />
      </Suspense>
    ),
    handle: { title: "Sign in" },
  },
  {
    path: "/admin",
    element: staffShell,
    children: [
      { index: true, element: <DashboardPage />, handle: { title: "Today" } },
      { path: "dashboard", element: <Navigate to="/admin" replace /> },
      { path: "check-in", element: <CheckInPage />, handle: { title: "Check-in" } },
      { path: "members", element: <MembersPage />, handle: { title: "Members" } },
      { path: "members/new", element: <NewMemberPage />, handle: { title: "New member" } },
      { path: "members/:id", element: <MemberProfilePage />, handle: { title: "Member" } },
      { path: "payments", element: <PaymentsPage />, handle: { title: "Payments" } },
      { path: "leads", element: <LeadsPage />, handle: { title: "Leads" } },
      { path: "plans", element: <PlansPage />, handle: { title: "Plans" } },
      { path: "trainers", element: <TrainersPage />, handle: { title: "Trainers" } },
      { path: "campaigns", element: <CampaignsPage />, handle: { title: "Campaigns" } },
      { path: "email/campaigns", element: <Navigate to="/admin/campaigns" replace /> },
      { path: "settings", element: <SettingsPage />, handle: { title: "Settings" } },
      { path: "*", element: <NotFoundPage />, handle: { title: "Not found" } },
    ],
  },
  {
    path: "/member",
    element: <MemberLayout />,
    children: [
      { path: "login", element: <MemberLogin /> },
      { path: "join", element: <JoinGymForm /> },
      {
        element: <MemberProtectedRoute />,
        children: [
          { path: "dashboard", element: <MemberDashboard /> },
          { path: "join/form", element: <JoinGymForm /> },
          { path: "membership", element: <MyMembership /> },
          { path: "payments", element: <Payments /> },
          { path: "profile", element: <MemberProfile /> },
          { path: "account", element: <AccountHub /> },
          { path: "account/addresses", element: <AccountAddresses /> },
          { path: "account/membership-history", element: <AccountMembershipHistory /> },
          { path: "account/settings", element: <AccountSettings /> },
        ],
      },
    ],
  },
  {
    element: <MarketingLayout />,
    children: [
      { path: "/", element: <Home /> },
      { path: "/shop", element: <Shop /> },
      { path: "*", element: <Home /> },
    ],
  },
]);

export default function App() {
  return (
    <MemberAuthProvider>
      <RouterProvider router={router} />
    </MemberAuthProvider>
  );
}
