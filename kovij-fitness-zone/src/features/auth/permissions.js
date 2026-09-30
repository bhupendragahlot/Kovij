import { useSelector } from "react-redux";
import { selectRole } from "./sessionSlice";
import { can } from "./permissionRules";

/**
 * Role checks for the UI. The rules live in permissionRules.js (a mirror of the server's);
 * the server stays the authority, this only hides controls that would be refused.
 */
export { can };

export function usePermission(action) {
  const role = useSelector(selectRole);
  return can(role, action);
}

/** Render children only when the current role may perform `action`. */
export function Can({ action, children, fallback = null }) {
  return usePermission(action) ? children : fallback;
}
