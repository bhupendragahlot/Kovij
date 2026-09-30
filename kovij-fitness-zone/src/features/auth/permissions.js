import { useSelector } from "react-redux";
import { selectRole } from "./sessionSlice";

/**
 * What each role may do. Mirrors the server's requireRole checks; the server stays the
 * authority; this only hides controls that would be refused.
 *   admin   owner: everything
 *   manager money and people: prices, plans, revenue, campaigns
 *   staff   front desk: check-ins, members, collecting payments
 */
const RULES = {
  "revenue.view": ["admin", "manager"],
  "plans.manage": ["admin", "manager"],
  "trainers.manage": ["admin", "manager"],
  "campaigns.manage": ["admin", "manager"],
  "membership.cancel": ["admin", "manager"],
  "price.override": ["admin", "manager"],
  "settings.manage": ["admin"],
  "staff.manage": ["admin"],
};

export const can = (role, action) => Boolean(role && RULES[action]?.includes(role));

export function usePermission(action) {
  const role = useSelector(selectRole);
  return can(role, action);
}

/** Render children only when the current role may perform `action`. */
export function Can({ action, children, fallback = null }) {
  return usePermission(action) ? children : fallback;
}
