import { Dumbbell, IndianRupee, Inbox, LayoutDashboard, Layers, Megaphone, ScanLine, Settings, Users } from "lucide-react";
import { can } from "../../features/auth/permissions";

/**
 * Single source of truth for navigation. The sidebar, phone bottom bar, "More" sheet and
 * command palette all read from here.
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
      { id: "check-in", label: "Check-in", to: "/admin/check-in", icon: ScanLine, mobile: "primary" },
      { id: "members", label: "Members", to: "/admin/members", icon: Users, mobile: "tab" },
      { id: "payments", label: "Payments", to: "/admin/payments", icon: IndianRupee, mobile: "tab" },
      { id: "leads", label: "Leads", to: "/admin/leads", icon: Inbox, mobile: "more" },
    ],
  },
  {
    label: "Manage",
    items: [
      { id: "plans", label: "Plans", to: "/admin/plans", icon: Layers, mobile: "more" },
      { id: "trainers", label: "Trainers", to: "/admin/trainers", icon: Dumbbell, mobile: "more" },
      { id: "campaigns", label: "Campaigns", to: "/admin/campaigns", icon: Megaphone, mobile: "more", permission: "campaigns.manage" },
      { id: "settings", label: "Settings", to: "/admin/settings", icon: Settings, mobile: "more" },
    ],
  },
];

export function visibleNav(role) {
  return NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || can(role, i.permission)) })).filter((g) => g.items.length);
}

export const flatNav = (role) => visibleNav(role).flatMap((g) => g.items);
