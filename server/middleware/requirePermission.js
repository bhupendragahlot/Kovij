import { AppError } from './errorHandler.js';
import { PERMISSIONS, can } from '../config/permissions.js';

/**
 * Permission gate for staff routes. Must run after `adminAuth`.
 *   router.get('/expenses', requirePermission('expenses.manage'), listExpenses)
 * Throws at startup (not per request) if the permission name is misspelled.
 */
export function requirePermission(permission) {
  if (!PERMISSIONS[permission]) throw new Error(`Unknown permission "${permission}" (see server/config/permissions.js)`);
  return (req, res, next) => {
    if (can(req.staffUser?.role, permission)) return next();
    next(new AppError('Your role does not allow this action', 403, 'FORBIDDEN'));
  };
}
