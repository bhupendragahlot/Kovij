import { lazy, Suspense } from "react";
import MemberLayout from "../../pages/member/MemberLayout";
import MemberLogin from "../../pages/member/Login";
import JoinGymForm from "../../pages/member/JoinGymForm";
import { JoinEntry, Redirect } from "./RouteHelpers";
import { Skeleton } from "../../shared/ui";

const MemberAppLayout = lazy(() => import("./MemberAppLayout"));
const HomePage = lazy(() => import("./pages/HomePage"));
const PassPage = lazy(() => import("./pages/PassPage"));
const VisitsPage = lazy(() => import("./pages/VisitsPage"));
const MembershipPage = lazy(() => import("./pages/MembershipPage"));
const PaymentsPage = lazy(() => import("./pages/PaymentsPage"));
const WorkoutsPage = lazy(() => import("./pages/WorkoutsPage"));
const DietPage = lazy(() => import("./pages/DietPage"));
const ProgressPage = lazy(() => import("./pages/ProgressPage"));
const UpdatesPage = lazy(() => import("./pages/UpdatesPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));
const MorePage = lazy(() => import("./pages/ProfilePage").then((m) => ({ default: m.MorePage })));
const SupportListPage = lazy(() => import("./pages/SupportPages").then((m) => ({ default: m.SupportListPage })));
const NewSupportPage = lazy(() => import("./pages/SupportPages").then((m) => ({ default: m.NewSupportPage })));
const SupportThreadPage = lazy(() => import("./pages/SupportPages").then((m) => ({ default: m.SupportThreadPage })));

const page = (el) => <Suspense fallback={<Skeleton className="h-64 rounded-card" />}>{el}</Suspense>;

export const memberRoutes = [
  {
    path: "/member",
    element: <MemberLayout />,
    children: [
      { path: "login", element: <MemberLogin /> },
      { path: "join", element: <JoinEntry /> },
      // The longer self-registration form (health, goals, uploads) stays available.
      { path: "join/form", element: <JoinGymForm /> },
    ],
  },
  {
    path: "/member",
    element: (
      <Suspense fallback={<div className="kv-app min-h-dvh bg-canvas" />}>
        <MemberAppLayout />
      </Suspense>
    ),
    children: [
      { index: true, element: <Redirect to="/member/home" /> },
      { path: "home", element: page(<HomePage />) },
      { path: "pass", element: page(<PassPage />) },
      { path: "visits", element: page(<VisitsPage />) },
      { path: "membership", element: page(<MembershipPage />) },
      { path: "payments", element: page(<PaymentsPage />) },
      { path: "payments/:id", element: <Redirect to="/member/payments" /> },
      { path: "workouts", element: page(<WorkoutsPage />) },
      { path: "diet", element: page(<DietPage />) },
      { path: "progress", element: page(<ProgressPage />) },
      { path: "progress/*", element: <Redirect to="/member/progress" /> },
      { path: "notifications", element: page(<UpdatesPage />) },
      { path: "announcements", element: <Redirect to="/member/notifications?tab=gym" /> },
      { path: "support", element: page(<SupportListPage />) },
      { path: "support/new", element: page(<NewSupportPage />) },
      { path: "support/:id", element: page(<SupportThreadPage />) },
      { path: "profile", element: page(<ProfilePage />) },
      { path: "more", element: page(<MorePage />) },
      { path: "dashboard", element: <Redirect to="/member/home" /> },
      { path: "account/*", element: <Redirect to="/member/profile" /> },
      { path: "*", element: <Redirect to="/member/home" /> },
    ],
  },
];
