import { Apple, Bell, CalendarCheck, CreditCard, Dumbbell, House, IdCard, LifeBuoy, LineChart, UserRound } from "lucide-react";

/** Every member app destination. `tab` places it in the phone bottom bar; the rest live under More. */
export const MEMBER_NAV = [
  { to: "/member/home", label: "Home", icon: House, tab: true },
  { to: "/member/workouts", label: "Workouts", icon: Dumbbell, tab: true },
  { to: "/member/diet", label: "Diet", icon: Apple },
  { to: "/member/progress", label: "Progress", icon: LineChart },
  { to: "/member/visits", label: "Visits", icon: CalendarCheck },
  { to: "/member/membership", label: "My plan", icon: IdCard },
  { to: "/member/payments", label: "Payments", icon: CreditCard, tab: true },
  { to: "/member/notifications", label: "Updates", icon: Bell, badge: "unread" },
  { to: "/member/support", label: "Help", icon: LifeBuoy },
  { to: "/member/profile", label: "Profile", icon: UserRound },
];
