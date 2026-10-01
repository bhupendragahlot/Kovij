/**
 * OWNER: security module. Mounted on every /api request (server.js), before the routers.
 *
 * Records staff changes (POST/PUT/PATCH/DELETE) in the activity log. Staff identity
 * (req.staffUser) is set later by adminAuth inside each router, so the entry is written from
 * `res.on('finish')`, after the response has gone out: logging never slows or fails a request.
 * Stored: who, what kind of change, which record, the outcome, IP and device. Never the request
 * body, passwords, tokens, health data or card details.
 */
import { describeRoute, pickResultFacts, recordActivity } from '../services/activityService.js';

const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function activityLog(req, res, next) {
  if (!MUTATING.has(req.method)) return next();

  // Note which member / amount the response reports, without keeping the response.
  let facts = {};
  const json = res.json.bind(res);
  res.json = (body) => {
    try {
      facts = pickResultFacts(body);
    } catch {
      facts = {};
    }
    return json(body);
  };

  res.on('finish', () => {
    const actor = req.staffUser;
    if (!actor?.id) return; // members, public forms and failed sign-ins aren't staff activity
    if (res.get('Idempotent-Replayed') === 'true') return; // a retry of something already logged
    const url = req.originalUrl || req.url;
    if (url.includes('/_test/')) return;

    const route = describeRoute(req.method, url);
    const ok = res.statusCode < 400;
    recordActivity({
      at: new Date(),
      actor: { id: actor.id, name: actor.name, role: actor.role },
      method: req.method,
      route: route.route,
      action: route.action,
      kind: route.kind,
      entityType: route.entityType,
      entityId: route.entityId || facts.entityId,
      memberId: route.memberId || facts.memberId,
      amount: ok ? facts.amount : undefined,
      status: res.statusCode,
      ok,
      ip: req.ip,
      userAgent: String(req.get('user-agent') || '').slice(0, 300),
    });
  });

  next();
}
