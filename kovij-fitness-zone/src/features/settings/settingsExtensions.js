import { lazy } from "react";

/**
 * Settings sections owned by other modules. Foundation-owned list: modules fill in their own
 * component files; they do not edit this list. Each component receives { settings, readOnly }
 * and saves through useUpdateSettings() (PATCH /admin/settings; nested groups merge field by field).
 */
export const SETTINGS_SECTIONS = [
  { value: "hours", label: "Logo, hours and holidays", permission: "members.view", Component: lazy(() => import("./GymProfileSettings")) },
  { value: "payment-methods", label: "Payments", permission: "revenue.view", Component: lazy(() => import("../payments/PaymentSettings")) },
  { value: "reminders", label: "Reminders", permission: "reminders.manage", Component: lazy(() => import("../reminders/ReminderSettings")) },
  { value: "email", label: "Email", permission: "settings.manage", Component: lazy(() => import("./EmailSettings")) },
];
