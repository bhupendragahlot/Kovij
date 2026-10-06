import { lazy } from "react";

/**
 * Tabs and header actions other modules add to the member profile. Foundation-owned list:
 * modules fill in their own component files; they do not edit this list or MemberProfilePage.
 *
 * Tab components receive { member, profile, memberships, payments, attendance } (the profile
 * payload) and fetch anything else themselves. `permission` hides the tab for roles without it.
 */
export const PROFILE_TABS = [
  { value: "attendance", label: "Attendance", permission: "attendance.view", Component: lazy(() => import("../attendance/MemberAttendanceTab")) },
  { value: "workouts", label: "Workouts", permission: "members.view", Component: lazy(() => import("../workouts/MemberWorkoutTab")) },
  { value: "diet", label: "Diet", permission: "members.view", Component: lazy(() => import("../diet/MemberDietTab")) },
  { value: "progress", label: "Progress", permission: "members.view", Component: lazy(() => import("../progress/MemberProgressTab")) },
  { value: "notes", label: "Notes", permission: "notes.manage", Component: lazy(() => import("../notes/MemberNotesTab")) },
];

/** Header actions: components rendered beside the profile's own buttons. Receive { member }. */
export const PROFILE_ACTIONS = [
  { key: "message", permission: "communication.send", Component: lazy(() => import("../communication/MemberMessageAction")) },
  { key: "app-login", permission: "members.view", Component: lazy(() => import("./MemberAppLoginAction")) },
];
