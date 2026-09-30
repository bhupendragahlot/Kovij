// Foundation checks: route registry, roles and permissions, settings patching.
import { adminToken, call, check, finish, staffToken } from '../lib.mjs';

const T = await adminToken();

// Route registry: every module mount answers (auth first), unknown paths are 404.
for (const path of ['/admin/expenses', '/admin/workouts', '/admin/reports', '/admin/memberships']) {
  const r = await call('GET', `${path}/__nope__`);
  check(`${path} is mounted behind staff auth`, r.status === 401, r.status);
}
check('unknown API path is 404', (await call('GET', '/admin/definitely-not-here', { token: T })).status === 404);

// Trainer role: signs in, can read members, cannot touch leads or staff.
const trainer = await staffToken('trainer', T);
check('trainer role can sign in', Boolean(trainer.token) && trainer.user.role === 'trainer', trainer.user);
check('trainer can view members', (await call('GET', '/admin/members', { token: trainer.token })).status === 200);
check('trainer cannot manage leads (403)', (await call('GET', '/admin/leads', { token: trainer.token })).status === 403);
check('trainer cannot manage staff (403)', (await call('GET', '/admin/staff', { token: trainer.token })).status === 403);
check('trainer cannot change settings (403)', (await call('PATCH', '/admin/settings', { token: trainer.token, body: { gymName: 'x' } })).status === 403);

const desk = await staffToken('staff', T);
check('front desk can manage leads', (await call('GET', '/admin/leads', { token: desk.token })).status === 200);
check('front desk can view attendance', (await call('GET', '/admin/attendance', { token: desk.token })).status === 200);

// Settings: nested groups are patched field by field.
await call('PATCH', '/admin/settings', { token: T, body: { payments: { upiId: 'kovij@upi', payeeName: 'Kovij Fitness' } } });
const after = await call('PATCH', '/admin/settings', { token: T, body: { payments: { allowPartial: false } } });
check(
  'saving one payment setting keeps the others',
  after.body.settings.payments.upiId === 'kovij@upi' && after.body.settings.payments.allowPartial === false && after.body.settings.payments.acceptCash === true,
  after.body.settings.payments
);
check('reminder defaults present', Array.isArray(after.body.settings.reminders?.expiryDaysBefore) && after.body.settings.reminders.enabled === true, after.body.settings.reminders);
check('opening hours default to 7 days', after.body.settings.openingHours?.length === 7, after.body.settings.openingHours);
const pub = await call('GET', '/settings');
check('public settings include hours but not payment config', Array.isArray(pub.body.openingHours) && pub.body.payments === undefined);

finish();
