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
// Platform modules (each file owned by one module; see docs/platform/README.md)
const RenewalsPage = lazy(() => import("./features/renewals/RenewalsPage"));
const AttendancePage = lazy(() => import("./features/attendance/AttendancePage"));
const KioskPage = lazy(() => import("./features/attendance/KioskPage"));
const RevenuePage = lazy(() => import("./features/finance/RevenuePage"));
const ExpensesPage = lazy(() => import("./features/expenses/ExpensesPage"));
const WorkoutsPage = lazy(() => import("./features/workouts/WorkoutsPage"));
const WorkoutPlanPage = lazy(() => import("./features/workouts/WorkoutPlanPage"));
const ExerciseLibraryPage = lazy(() => import("./features/workouts/ExerciseLibraryPage"));
const DietPlansPage = lazy(() => import("./features/diet/DietPlansPage"));
const DietPlanPage = lazy(() => import("./features/diet/DietPlanPage"));
const AnnouncementsPage = lazy(() => import("./features/announcements/AnnouncementsPage"));
const ActivityLogPage = lazy(() => import("./features/activity/ActivityLogPage"));
const ReportsPage = lazy(() => import("./features/reports/ReportsPage"));
const SupportInboxPage = lazy(() => import("./features/support/SupportInboxPage"));
const ForgotPasswordPage = lazy(() => import("./features/auth/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./features/auth/ResetPasswordPage"));

const standalone = (page) => <Suspense fallback={<div className="min-h-dvh bg-canvas" />}>{page}</Suspense>;

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
  { path: "/admin/forgot-password", element: standalone(<ForgotPasswordPage />), handle: { title: "Reset password" } },
  { path: "/admin/reset-password", element: standalone(<ResetPasswordPage />), handle: { title: "Choose a new password" } },
  {
    // Full-screen QR check-in for a tablet at the entrance (staff signed in, no app chrome).
    path: "/admin/kiosk",
    element: standalone(
      <ConfirmProvider>
        <RequireStaff>
          <KioskPage />
        </RequireStaff>
      </ConfirmProvider>
    ),
    handle: { title: "Check-in kiosk" },
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
      { path: "renewals", element: <RenewalsPage />, handle: { title: "Renewals" } },
      { path: "attendance", element: <AttendancePage />, handle: { title: "Attendance" } },
      { path: "revenue", element: <RevenuePage />, handle: { title: "Revenue" } },
      { path: "expenses", element: <ExpensesPage />, handle: { title: "Expenses" } },
      { path: "workouts", element: <WorkoutsPage />, handle: { title: "Workout plans" } },
      { path: "workouts/:id", element: <WorkoutPlanPage />, handle: { title: "Workout plan" } },
      { path: "exercises", element: <ExerciseLibraryPage />, handle: { title: "Exercise library" } },
      { path: "diets", element: <DietPlansPage />, handle: { title: "Diet plans" } },
      { path: "diets/:id", element: <DietPlanPage />, handle: { title: "Diet plan" } },
      { path: "announcements", element: <AnnouncementsPage />, handle: { title: "Announcements" } },
      { path: "activity", element: <ActivityLogPage />, handle: { title: "Activity log" } },
      { path: "reports", element: <ReportsPage />, handle: { title: "Reports" } },
      { path: "support", element: <SupportInboxPage />, handle: { title: "Support inbox" } },
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
