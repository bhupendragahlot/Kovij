import {
  BarChart3,
  BellRing,
  BookOpen,
  CalendarClock,
  ClipboardList,
  Dumbbell,
  IndianRupee,
  Inbox,
  LayoutDashboard,
  Layers,
  LifeBuoy,
  Megaphone,
  Receipt,
  Salad,
  ScanLine,
  ScrollText,
  Settings,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { can } from "../../features/auth/permissions";

/**
 * Single source of truth for navigation. The sidebar, phone bottom bar, "More" sheet and
 * command palette all read from here. Items with `permission` are hidden for roles without it.
 *
 * mobile: "tab"     → phone bottom bar
 *         "primary" → the raised centre button on the phone bottom bar
 *         "more"    → phone "More" sheet
 */
export const NAV_GROUPS = [
  {
    label: "Daily",
    items: [
      { id: "today", label: "Today", to: "/admin", end: true, icon: LayoutDashboard, mobile: "tab" },
      { id: "check-in", label: "Check-in", to: "/admin/check-in", icon: ScanLine, mobile: "primary", permission: "attendance.checkin" },
      { id: "members", label: "Members", to: "/admin/members", icon: Users, mobile: "tab", permission: "members.view" },
      { id: "payments", label: "Payments", to: "/admin/payments", icon: IndianRupee, mobile: "tab", permission: "payments.view" },
      { id: "renewals", label: "Renewals", to: "/admin/renewals", icon: CalendarClock, mobile: "more", permission: "renewals.view" },
      { id: "attendance", label: "Attendance", to: "/admin/attendance", icon: ClipboardList, mobile: "more", permission: "attendance.view" },
      { id: "leads", label: "Leads", to: "/admin/leads", icon: Inbox, mobile: "more", permission: "leads.manage" },
      { id: "support", label: "Support inbox", to: "/admin/support", icon: LifeBuoy, mobile: "more", permission: "support.manage" },
    ],
  },
  {
    label: "Coaching",
    items: [
      { id: "workouts", label: "Workout plans", to: "/admin/workouts", icon: Dumbbell, mobile: "more", permission: "workouts.manage" },
      { id: "exercises", label: "Exercise library", to: "/admin/exercises", icon: BookOpen, mobile: "more", permission: "workouts.manage" },
      { id: "diets", label: "Diet plans", to: "/admin/diets", icon: Salad, mobile: "more", permission: "diets.manage" },
      { id: "trainers", label: "Trainers", to: "/admin/trainers", icon: UserRound, mobile: "more" },
    ],
  },
  {
    label: "Business",
    items: [
      { id: "revenue", label: "Revenue", to: "/admin/revenue", icon: TrendingUp, mobile: "more", permission: "revenue.view" },
      { id: "expenses", label: "Expenses", to: "/admin/expenses", icon: Receipt, mobile: "more", permission: "expenses.manage" },
      { id: "reports", label: "Reports", to: "/admin/reports", icon: BarChart3, mobile: "more", permission: "reports.view" },
      { id: "plans", label: "Plans", to: "/admin/plans", icon: Layers, mobile: "more", permission: "members.edit" },
      { id: "campaigns", label: "Campaigns", to: "/admin/campaigns", icon: Megaphone, mobile: "more", permission: "campaigns.manage" },
      { id: "announcements", label: "Announcements", to: "/admin/announcements", icon: BellRing, mobile: "more", permission: "announcements.manage" },
    ],
  },
  {
    label: "Admin",
    items: [
      { id: "activity", label: "Activity log", to: "/admin/activity", icon: ScrollText, mobile: "more", permission: "activity.view" },
      { id: "settings", label: "Settings", to: "/admin/settings", icon: Settings, mobile: "more" },
    ],
  },
];

export function visibleNav(role) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter((g) => g.items.length);
}

export const flatNav = (role) => visibleNav(role).flatMap((g) => g.items);
