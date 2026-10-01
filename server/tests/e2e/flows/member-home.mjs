// Member app home: week strip, crowd, weight, unread updates.
import { adminToken, call, check, createMember, createPlan, finish, key, staffToken } from '../lib.mjs';

const T = await adminToken();
const desk = await staffToken('staff', T);
const plan = await createPlan(T, { price: 1200 });
const { member, token: M } = await createMember(T, { planId: plan._id });

check('home needs a member session', (await call('GET', '/member/home')).status === 401);
check('a staff token can’t open member home', [401, 403].includes((await call('GET', '/member/home', { token: T })).status));

const before = await call('GET', '/member/home', { token: M });
check('home answers for a new member', before.status === 200 && before.body.visits.thisMonth === 0 && before.body.weight === null, before.body);
check('week strip runs Monday to Sunday with today marked', before.body.visits.week.length === 7 && before.body.visits.week[0].label === 'Mon' && before.body.visits.week.filter((d) => d.isToday).length === 1);
check('crowd forecast has a level', ['quiet', 'moderate', 'busy'].includes(before.body.crowd.level) && Array.isArray(before.body.crowd.hours));
check('unread updates is a number', typeof before.body.unread === 'number');

await call('POST', '/admin/attendance', { token: desk.token, body: { memberId: member._id }, idem: key() });
const entry = await call('POST', `/admin/members/${member._id}/progress/entries`, { token: T, body: { weightKg: 81.5 }, idem: key() });
check('a coach records a weight', entry.status === 201, entry.body);
const after = await call('GET', '/member/home', { token: M });
check('today’s check-in shows on the week strip and the month count', after.body.visits.thisMonth === 1 && after.body.visits.week.find((d) => d.isToday)?.visited === true, after.body.visits);
check('the latest weight shows, with no change from a single entry', after.body.weight?.latestKg === 81.5 && after.body.weight.changeKg === null, after.body.weight);
check('the visit counts toward the streak', after.body.visits.streak.current >= 1);

finish();
