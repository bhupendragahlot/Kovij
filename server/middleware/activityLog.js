/**
 * OWNER: security module. Mounted on every /api request (server.js), before the routers.
 * Staff identity (req.staffUser) is set later by adminAuth inside each router, so record from
 * `res.on('finish', …)`, when it is available. Placeholder: records nothing yet.
 */
export function activityLog(req, res, next) {
  next();
}
