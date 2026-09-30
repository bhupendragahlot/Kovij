import { AppError } from './errorHandler.js';

/**
 * Role gate for staff routes. Must run after `adminAuth`.
 * Roles: admin (owner, everything) > manager (money + people) > staff (desk operations).
 *
 * @param {...('admin'|'manager'|'staff')} roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (roles.includes(req.staffUser?.role)) return next();
    next(new AppError('Your role does not allow this action', 403, 'FORBIDDEN'));
  };
}

/** Shorthand for actions that move money or change prices. */
export const requireManager = requireRole('admin', 'manager');
export const requireAdmin = requireRole('admin');
