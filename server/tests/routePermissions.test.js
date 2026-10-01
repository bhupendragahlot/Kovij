/**
 * Every staff route that changes data must name the permission it needs (requirePermission),
 * so a new endpoint can't quietly skip the role checks. Walks the real routers in routes/index.js.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOUNTS } from '../routes/index.js';

/** Self-service routes every signed-in staff member may use. */
const SELF_SERVICE = new Set(['POST /auth/change-password']);
const READ = new Set(['get', 'head', 'options']);

function mountPath(layer) {
  if (layer.regexp?.fast_slash) return '';
  return (layer.regexp?.source || '').replace(/^\^/, '').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
}

/** [{ method, path, guards: [middleware names…], permissions: [...] }] */
function collect(prefix, router, inherited = []) {
  const out = [];
  const chain = [...inherited];
  for (const layer of router.stack || []) {
    if (layer.route) {
      const handlers = [...chain, ...layer.route.stack.map((l) => l.handle)];
      for (const method of Object.keys(layer.route.methods)) {
        if (method === '_all') continue;
        out.push({
          method,
          path: prefix + (layer.route.path === '/' ? '' : layer.route.path),
          staff: handlers.some((h) => h.name === 'adminAuth'),
          permissions: handlers.map((h) => h.permission).filter(Boolean),
        });
      }
    } else if (layer.handle?.stack) {
      out.push(...collect(prefix + mountPath(layer), layer.handle, chain));
    } else {
      chain.push(layer.handle);
    }
  }
  return out;
}

const routes = MOUNTS.flatMap(([path, router]) => collect(path, router));

test('the route walker finds the staff API', () => {
  assert.ok(routes.length > 100, `only ${routes.length} routes found`);
  assert.ok(routes.some((r) => r.path === '/admin/members' && r.method === 'post'));
});

test('every /admin route requires a staff session', () => {
  const open = routes.filter((r) => r.path.startsWith('/admin') && !r.staff).map((r) => `${r.method.toUpperCase()} ${r.path}`);
  assert.deepEqual(open, [], `These /admin routes don't use adminAuth:\n${open.join('\n')}`);
});

test('every staff route that changes data checks a permission', () => {
  const missing = routes
    .filter((r) => r.staff && !READ.has(r.method) && !r.permissions.length)
    .map((r) => `${r.method.toUpperCase()} ${r.path}`)
    .filter((key) => !SELF_SERVICE.has(key));
  assert.deepEqual(missing, [], `Add requirePermission(...) to:\n${missing.join('\n')}`);
});
