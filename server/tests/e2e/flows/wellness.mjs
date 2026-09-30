// Wellness module: diet plans, nutrition log, body progress, progress photos, staff notes.
import { API, adminToken, call, check, createMember, finish, key, memberToken, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const trainer = await staffToken('trainer', T);
const desk = await staffToken('staff', T);
const manager = await staffToken('manager', T);
const { member: ravi, token: raviT } = await createMember(T, { name: uniq('Ravi ') });
const { member: priya, token: priyaT } = await createMember(T, { name: uniq('Priya ') });

const dayKey = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date(Date.now() + offset * 86_400_000));
const today = dayKey(0);
const fields = (r) => r.body?.details?.fields || {};

// ── Diet plans ──────────────────────────────────────────────────────────────

const planBody = {
  name: uniq('Veg fat loss '),
  goal: 'weight_loss',
  dietType: 'veg',
  targets: { calories: 1800, proteinG: 90 },
  meals: [
    {
      name: 'Breakfast',
      time: '07:30',
      items: [
        { food: 'Poha', quantity: '1 plate', calories: 250, proteinG: 5, carbsG: 45, fatG: 6 },
        // No calories: worked out from macros (4×6.4 + 4×9.6 + 9×6.6 = 123).
        { food: 'Milk', quantity: '200 ml', proteinG: 6.4, carbsG: 9.6, fatG: 6.6 },
      ],
    },
    {
      name: 'Lunch',
      time: '13:00',
      items: [
        { food: 'Dal', quantity: '1 katori', calories: 150, proteinG: 9, carbsG: 20, fatG: 4 },
        { food: 'Roti', quantity: '2', calories: 240, proteinG: 8, carbsG: 44, fatG: 4 },
      ],
    },
  ],
  notes: 'Drink water before meals.',
};

check('signed-out request is refused (401)', (await call('GET', '/admin/diets')).status === 401);
check('front desk cannot open diet plans (403)', (await call('GET', '/admin/diets', { token: desk.token })).status === 403);
check('front desk cannot create a diet plan (403)', (await call('POST', '/admin/diets', { token: desk.token, body: planBody, idem: key() })).status === 403);
check('member token cannot reach staff diet routes (403)', (await call('GET', '/admin/diets', { token: raviT })).status === 403);

const createKey = key();
const created = await call('POST', '/admin/diets', { token: trainer.token, body: planBody, idem: createKey });
check('trainer creates a diet plan', created.status === 201 && created.body.plan?._id, created.body);
const plan = created.body.plan;
check('blank calories filled from macros', plan.meals[0].items[1].calories === 123, plan.meals[0].items[1]);
check('meal totals computed', plan.meals[0].totals.calories === 373 && plan.meals[1].totals.proteinG === 17, plan.meals.map((m) => m.totals));
check('day totals computed', plan.totals.calories === 763 && plan.totals.carbsG === 118.6, plan.totals);
const replay = await call('POST', '/admin/diets', { token: trainer.token, body: planBody, idem: createKey });
check('retried create returns the same plan', replay.body.plan?._id === plan._id && replay.headers.get('idempotent-replayed') === 'true');

const badTime = await call('POST', '/admin/diets', { token: trainer.token, body: { ...planBody, meals: [{ name: 'Breakfast', time: '7:30' }] }, idem: key() });
check('meal time must be HH:MM (422 on the field)', badTime.status === 422 && fields(badTime)['meals.0.time'], badTime.body);
const badType = await call('POST', '/admin/diets', { token: trainer.token, body: { ...planBody, dietType: 'keto' }, idem: key() });
check('unknown diet type is rejected', badType.status === 422 && fields(badType).dietType, badType.body);

const saved = await call('PUT', `/admin/diets/${plan._id}`, {
  token: trainer.token,
  body: { ...planBody, meals: [...planBody.meals, { name: 'Dinner', time: '20:00', items: [{ food: 'Khichdi', quantity: '1 bowl', calories: 350, proteinG: 12, carbsG: 55, fatG: 8 }] }] },
});
check('saving the plan recomputes totals', saved.status === 200 && saved.body.plan.meals.length === 3 && saved.body.plan.totals.calories === 1113, saved.body);

const list = await call('GET', '/admin/diets', { token: manager.token, body: undefined });
const listed = list.body.plans?.find((p) => p._id === plan._id);
check('plan list shows totals and member count', listed && listed.totals.calories === 1113 && listed.memberCount === 0 && listed.mealCount === 3, listed);

const empty = await call('POST', '/admin/diets', { token: trainer.token, body: { name: uniq('Empty ') }, idem: key() });
const emptyAssign = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: trainer.token, body: { planId: empty.body.plan._id }, idem: key() });
check('a plan with no meals cannot be given out', emptyAssign.status === 409 && emptyAssign.body.code === 'PLAN_EMPTY', emptyAssign.body);

// ── Giving a plan and the daily log ─────────────────────────────────────────

check('front desk cannot give a diet plan (403)', (await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: desk.token, body: { planId: plan._id }, idem: key() })).status === 403);
const assignKey = key();
const assigned = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: trainer.token, body: { planId: plan._id, note: 'Start slow' }, idem: assignKey });
check('trainer gives the plan to a member', assigned.status === 201 && assigned.body.assignment?.state === 'current' && assigned.body.assignment.startDay === today, assigned.body);
check('member is notified', assigned.body.notified === true, assigned.body);
const assignedAgain = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: trainer.token, body: { planId: plan._id, note: 'Start slow' }, idem: assignKey });
check('retried assignment does not create a second one', assignedAgain.body.assignment?._id === assigned.body.assignment._id);
const farStart = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: trainer.token, body: { planId: plan._id, startDay: dayKey(90) }, idem: key() });
check('start date more than a month ahead is rejected', farStart.status === 422 && fields(farStart).startDay, farStart.body);
const noMember = await call('GET', '/admin/diets/members/5f0000000000000000000000', { token: trainer.token });
check('unknown member is 404', noMember.status === 404);

const deskView = await call('GET', `/admin/diets/members/${ravi._id}`, { token: desk.token });
check('front desk can view the member\'s diet', deskView.status === 200 && deskView.body.current?.name === planBody.name && deskView.body.today.mealsPlanned === 3, deskView.body);

const mine = await call('GET', '/member/diet', { token: raviT });
check('member sees their current plan and today', mine.status === 200 && mine.body.current?.meals.length === 3 && mine.body.today.day === today && mine.body.today.editable === true, mine.body);
const [breakfast, lunch] = mine.body.current.meals;

const tick = await call('PUT', `/member/diet/days/${today}/meals/${breakfast._id}`, { token: raviT, body: { eaten: true } });
check('member ticks breakfast', tick.status === 200 && tick.body.day.mealsEaten === 1 && tick.body.day.totals.eaten.calories === 373, tick.body);
const tickAgain = await call('PUT', `/member/diet/days/${today}/meals/${breakfast._id}`, { token: raviT, body: { eaten: true } });
check('ticking twice counts once', tickAgain.body.day.mealsEaten === 1);
check('front desk cannot log meals for a member (403)', (await call('PUT', `/admin/diets/members/${ravi._id}/days/${today}/meals/${lunch._id}`, { token: desk.token, body: { eaten: true } })).status === 403);
const staffTick = await call('PUT', `/admin/diets/members/${ravi._id}/days/${today}/meals/${lunch._id}`, { token: trainer.token, body: { eaten: true } });
check('trainer ticks lunch for the member', staffTick.status === 200 && staffTick.body.day.mealsEaten === 2 && staffTick.body.day.totals.eaten.calories === 763, staffTick.body.day);

const extraKey = key();
const extraBody = { food: 'Samosa', quantity: '1', calories: 260, proteinG: 4, carbsG: 30, fatG: 14 };
const extra = await call('POST', `/member/diet/days/${today}/items`, { token: raviT, body: extraBody, idem: extraKey });
check('member adds an extra item', extra.status === 201 && extra.body.day.extras.length === 1 && extra.body.day.totals.eaten.calories === 1023, extra.body);
const extraRetry = await call('POST', `/member/diet/days/${today}/items`, { token: raviT, body: extraBody, idem: extraKey });
check('retried extra item is not added twice', extraRetry.body.day.extras.length === 1);
check('extra item needs an Idempotency-Key', (await call('POST', `/member/diet/days/${today}/items`, { token: raviT, body: extraBody })).status === 400);
const badExtra = await call('POST', `/member/diet/days/${today}/items`, { token: raviT, body: { food: '', calories: -5 }, idem: key() });
check('extra item validation (422 on fields)', badExtra.status === 422 && fields(badExtra).food, badExtra.body);

const water = await call('PUT', `/member/diet/days/${today}/water`, { token: raviT, body: { glasses: 5 } });
check('member sets water glasses', water.status === 200 && water.body.day.water.glasses === 5 && water.body.day.water.target === 8);
check('water above 30 glasses is rejected', (await call('PUT', `/member/diet/days/${today}/water`, { token: raviT, body: { glasses: 31 } })).status === 422);

const future = await call('PUT', `/member/diet/days/${dayKey(2)}/water`, { token: raviT, body: { glasses: 2 } });
check('future day cannot be logged', future.status === 422 && future.body.code === 'DAY_IN_FUTURE', future.body);
const old = await call('PUT', `/member/diet/days/${dayKey(-10)}/water`, { token: raviT, body: { glasses: 2 } });
check('day older than a week cannot be changed', old.status === 422 && old.body.code === 'DAY_TOO_OLD', old.body);
const yesterdayWater = await call('PUT', `/member/diet/days/${dayKey(-1)}/water`, { token: raviT, body: { glasses: 7 } });
check('yesterday can still be filled in', yesterdayWater.status === 200 && yesterdayWater.body.day.plan === null, yesterdayWater.body);
check('bad date in the URL is 404', (await call('GET', '/member/diet/days/2026-02-30', { token: raviT })).status === 404);

const removed = await call('DELETE', `/member/diet/days/${today}/items/${extra.body.day.extras[0]._id}`, { token: raviT });
check('member removes the extra item', removed.status === 200 && removed.body.day.extras.length === 0 && removed.body.day.totals.eaten.calories === 763);

const history = await call('GET', '/member/diet/history?days=7', { token: raviT });
const todayRow = history.body.days?.find((d) => d.day === today);
check('history shows daily totals against targets', todayRow && todayRow.eaten.calories === 763 && todayRow.targets.calories === 1800 && todayRow.waterGlasses === 5, history.body);
check('history summary averages logged days', history.body.summary?.daysLogged === 2, history.body.summary);

const priyaView = await call('GET', '/member/diet', { token: priyaT });
check('another member sees only their own (empty) diet', priyaView.status === 200 && priyaView.body.current === null && priyaView.body.today.mealsEaten === 0, priyaView.body);
check('member cannot tick a meal from someone else\'s plan', (await call('PUT', `/member/diet/days/${today}/meals/${breakfast._id}`, { token: priyaT, body: { eaten: true } })).status === 409);

// A new plan replaces the old one from its start date; ticks from the old plan don't carry over.
const plan2 = (await call('POST', '/admin/diets', { token: trainer.token, body: { ...planBody, name: uniq('Muscle gain ') }, idem: key() })).body.plan;
const replaced = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: manager.token, body: { planId: plan2._id }, idem: key() });
check('a new plan replaces the current one', replaced.status === 201, replaced.body);
const afterReplace = await call('GET', `/admin/diets/members/${ravi._id}`, { token: trainer.token });
check('overview: new plan current, old plan in history', afterReplace.body.current?.name === plan2.name && afterReplace.body.past.some((p) => p.name === planBody.name && p.state === 'ended'), afterReplace.body);
check('today starts fresh on the new plan', afterReplace.body.today.mealsEaten === 0 && afterReplace.body.today.water.glasses === 5, afterReplace.body.today);
const staleTick = await call('PUT', `/member/diet/days/${today}/meals/${breakfast._id}`, { token: raviT, body: { eaten: true } });
check('ticking a meal from the replaced plan is refused', staleTick.status === 404 && staleTick.body.code === 'MEAL_NOT_FOUND', staleTick.body);

const upcoming = await call('POST', `/admin/diets/members/${ravi._id}/assign`, { token: trainer.token, body: { planId: plan._id, startDay: dayKey(3) }, idem: key() });
check('a plan can start on a later date', upcoming.status === 201 && upcoming.body.assignment.state === 'upcoming', upcoming.body);
const withUpcoming = await call('GET', '/member/diet', { token: raviT });
check('member sees current and upcoming plans', withUpcoming.body.current?.name === plan2.name && withUpcoming.body.upcoming?.name === planBody.name, withUpcoming.body);
const plansList = await call('GET', '/member/diet/plans', { token: raviT });
check('member lists all their plans', plansList.status === 200 && plansList.body.plans.length === 3, plansList.body);

const onPlan = await call('GET', `/admin/diets/${plan._id}`, { token: trainer.token });
check('plan page lists members on it', onPlan.body.plan.members.some((m) => String(m.member._id) === String(ravi._id)), onPlan.body.plan.members);
const inUse = await call('DELETE', `/admin/diets/${plan._id}`, { token: trainer.token });
check('a plan members follow cannot be deleted', inUse.status === 409 && inUse.body.code === 'PLAN_IN_USE', inUse.body);

const stopped = await call('POST', `/admin/diets/members/${ravi._id}/stop`, { token: trainer.token });
check('stopping ends current and upcoming plans', stopped.status === 200 && stopped.body.current === null && stopped.body.upcoming === null, stopped.body);
check('stopping again says there is nothing to stop', (await call('POST', `/admin/diets/members/${ravi._id}/stop`, { token: trainer.token })).status === 409);

const archived = await call('PATCH', `/admin/diets/${plan._id}`, { token: trainer.token, body: { archived: true } });
check('plan can be archived', archived.status === 200 && archived.body.plan.archived === true);
const assignArchived = await call('POST', `/admin/diets/members/${priya._id}/assign`, { token: trainer.token, body: { planId: plan._id }, idem: key() });
check('an archived plan cannot be given out', assignArchived.status === 409 && assignArchived.body.code === 'PLAN_ARCHIVED', assignArchived.body);
check('patch only accepts archiving', (await call('PATCH', `/admin/diets/${plan._id}`, { token: trainer.token, body: { name: 'x' } })).status === 422);
const copy = await call('POST', `/admin/diets/${plan._id}/duplicate`, { token: trainer.token, idem: key() });
check('plan can be duplicated', copy.status === 201 && copy.body.plan.name.endsWith('(copy)') && copy.body.plan.totals.calories === 1113 && copy.body.plan.archived === false, copy.body);
check('unused plan can be deleted', (await call('DELETE', `/admin/diets/${copy.body.plan._id}`, { token: trainer.token })).status === 200);
check('deleted plan is gone', (await call('GET', `/admin/diets/${copy.body.plan._id}`, { token: trainer.token })).status === 404);

// ── Body measurements ───────────────────────────────────────────────────────

const P = `/admin/members/${ravi._id}/progress`;
check('progress needs a staff session (401)', (await call('GET', P)).status === 401);
const firstKey = key();
const first = await call('POST', `${P}/entries`, { token: desk.token, body: { day: dayKey(-30), weightKg: 83, heightCm: 175, waistCm: 96 }, idem: firstKey });
check('front desk records a measurement; BMI computed', first.status === 201 && first.body.entry.bmi === 27.1 && first.body.entry.recordedByKind === 'staff', first.body);
const firstRetry = await call('POST', `${P}/entries`, { token: desk.token, body: { day: dayKey(-30), weightKg: 83, heightCm: 175, waistCm: 96 }, idem: firstKey });
check('retried measurement returns the same entry', firstRetry.body.entry?._id === first.body.entry._id);
const sameDay = await call('POST', `${P}/entries`, { token: trainer.token, body: { day: dayKey(-30), weightKg: 82 }, idem: key() });
check('a second entry for the same day is refused with a pointer to edit', sameDay.status === 409 && sameDay.body.code === 'ENTRY_EXISTS' && sameDay.body.details.entryId === first.body.entry._id, sameDay.body);
const tooHeavy = await call('POST', `${P}/entries`, { token: trainer.token, body: { weightKg: 900 }, idem: key() });
check('impossible weight is rejected on the field', tooHeavy.status === 422 && fields(tooHeavy).weightKg, tooHeavy.body);
const nothing = await call('POST', `${P}/entries`, { token: trainer.token, body: { heightCm: 170 }, idem: key() });
check('an entry needs at least one measurement', nothing.status === 422 && fields(nothing).weightKg, nothing.body);
check('future measurement date is rejected', (await call('POST', `${P}/entries`, { token: trainer.token, body: { day: dayKey(1), weightKg: 80 }, idem: key() })).status === 422);

const latest = await call('POST', `${P}/entries`, { token: trainer.token, body: { weightKg: 80, waistCm: 92.5, bodyFatPct: 24 }, idem: key() });
check('height defaults from the profile for the next entry', latest.status === 201 && latest.body.entry.heightCm === 175 && latest.body.entry.bmi === 26.1, latest.body);
const overview = await call('GET', P, { token: trainer.token });
check('summary: change since first, BMI band', overview.body.summary?.change.weightKg === -3 && overview.body.summary.bmiCategory?.key === 'obese' && overview.body.defaults.heightCm === 175, overview.body.summary);
check('entries newest first with change since previous', overview.body.entries[0]._id === latest.body.entry._id && overview.body.entries[0].sincePrevious.waistCm === -3.5, overview.body.entries[0]);
const profile = await call('GET', `/admin/members/${ravi._id}`, { token: T });
check('profile weight follows the newest entry', profile.body.profile?.weightKg === 80 && profile.body.profile.bmi === 26.1, profile.body.profile);

const cleared = await call('PATCH', `${P}/entries/${latest.body.entry._id}`, { token: trainer.token, body: { waistCm: null, weightKg: 79.5 } });
check('editing clears a field and recomputes BMI', cleared.status === 200 && cleared.body.entry.waistCm === null && cleared.body.entry.bmi === 26, cleared.body);
const allCleared = await call('PATCH', `${P}/entries/${latest.body.entry._id}`, { token: trainer.token, body: { weightKg: null, bodyFatPct: null } });
check('an entry must keep one measurement', allCleared.status === 422, allCleared.body);

const own = await call('POST', '/member/progress/measurements', { token: raviT, body: { day: dayKey(-2), weightKg: 80.2 }, idem: key() });
check('member records their own weight', own.status === 201 && own.body.entry.recordedByKind === 'member' && own.body.entry.bmi === 26.2, own.body);
check('member edits their own entry', (await call('PATCH', `/member/progress/measurements/${own.body.entry._id}`, { token: raviT, body: { weightKg: 80.1 } })).status === 200);
const notTheirs = await call('PATCH', `/member/progress/measurements/${first.body.entry._id}`, { token: raviT, body: { weightKg: 70 } });
check('member cannot change a trainer\'s entry (403)', notTheirs.status === 403, notTheirs.body);
check('member cannot touch another member\'s entry (404)', (await call('DELETE', `/member/progress/measurements/${own.body.entry._id}`, { token: priyaT })).status === 404);
const summary = await call('GET', '/member/progress', { token: raviT });
check('member summary has BMI band text', summary.status === 200 && summary.body.summary.bmiCategory?.label === 'Obese' && summary.body.total === 3, summary.body.summary);
check('member deletes their own entry', (await call('DELETE', `/member/progress/measurements/${own.body.entry._id}`, { token: raviT })).status === 200);
const priyaProgress = await call('GET', '/member/progress/measurements', { token: priyaT });
check('another member sees none of it', priyaProgress.status === 200 && priyaProgress.body.total === 0);

// ── Progress photos ─────────────────────────────────────────────────────────

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const form = (bytes, { pose = 'front', day, type = 'image/png', name = 'photo.png' } = {}) => {
  const fd = new FormData();
  fd.append('photo', new Blob([bytes], { type }), name);
  if (pose) fd.append('pose', pose);
  if (day) fd.append('day', day);
  return fd;
};
const fetchFile = (path, token) => fetch(API + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });

const up = await call('POST', `${P}/photos`, { token: trainer.token, body: form(PNG) });
check('trainer uploads a front photo', up.status === 201 && up.body.photo?.pose === 'front' && up.body.photo.day === today, up.body);
const photo = up.body.photo;
const again = await call('POST', `${P}/photos`, { token: trainer.token, body: form(PNG) });
check('uploading the same day and pose replaces it', again.status === 200 && again.body.replaced === true && again.body.photo._id === photo._id, again.body);
const photos = await call('GET', `${P}/photos`, { token: desk.token });
check('photo list has one photo and no file path', photos.body.photos?.length === 1 && photos.body.days[0] === today && !JSON.stringify(photos.body).includes('private:'), photos.body);
const fileRes = await fetchFile(photo.url, trainer.token);
const fileBytes = Buffer.from(await fileRes.arrayBuffer());
check('photo streams to staff with private headers', fileRes.status === 200 && fileRes.headers.get('content-type') === 'image/png' && /no-store/.test(fileRes.headers.get('cache-control') || '') && fileBytes.equals(PNG), [fileRes.status, fileRes.headers.get('cache-control')]);
check('photo is not reachable without a session', (await fetchFile(photo.url)).status === 401);

const fake = await call('POST', `${P}/photos`, { token: trainer.token, body: form(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'), { pose: 'side' }) });
check('a non-image claiming to be PNG is rejected', fake.status === 422 && fake.body.code === 'INVALID_FILE_TYPE', fake.body);
const svg = await call('POST', `${P}/photos`, { token: trainer.token, body: form(Buffer.from('<svg/>'), { pose: 'side', type: 'image/svg+xml', name: 'x.svg' }) });
check('SVG uploads are rejected', svg.status === 422, svg.body);
const noPose = await call('POST', `${P}/photos`, { token: trainer.token, body: form(PNG, { pose: '' }) });
check('pose is required', noPose.status === 422 && fields(noPose).pose, noPose.body);
const huge = await call('POST', `${P}/photos`, { token: trainer.token, body: form(Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024 + 10)]), { pose: 'back' }) });
check('photos over 5 MB are rejected', huge.status === 413 && huge.body.code === 'FILE_TOO_LARGE', huge.body);

const memberPhotos = await call('GET', '/member/progress/photos', { token: raviT });
check('member sees their photos with member-app paths', memberPhotos.body.photos?.length === 1 && memberPhotos.body.photos[0].url === `/member/progress/photos/${photo._id}/file`, memberPhotos.body);
check('member streams their own photo', (await fetchFile(`/member/progress/photos/${photo._id}/file`, raviT)).status === 200);
check('another member cannot stream it (404)', (await fetchFile(`/member/progress/photos/${photo._id}/file`, priyaT)).status === 404);
check('staff cannot fetch it through another member\'s path (404)', (await fetchFile(`/admin/members/${priya._id}/progress/photos/${photo._id}/file`, trainer.token)).status === 404);
const selfie = await call('POST', '/member/progress/photos', { token: raviT, body: form(PNG, { pose: 'side', day: dayKey(-1) }) });
check('member uploads their own photo', selfie.status === 201 && selfie.body.photo.uploadedByKind === 'member', selfie.body);
check('member deletes their photo', (await call('DELETE', `/member/progress/photos/${selfie.body.photo._id}`, { token: raviT })).status === 200);
check('staff deletes a photo', (await call('DELETE', `${P}/photos/${photo._id}`, { token: trainer.token })).status === 200);
check('deleted photo no longer streams', (await fetchFile(photo.url, trainer.token)).status === 404);

// ── Staff notes ─────────────────────────────────────────────────────────────

const N = `/admin/members/${ravi._id}/notes`;
const noteKey = key();
const note = await call('POST', N, { token: trainer.token, body: { text: 'Knee pain on squats; avoid deep squats', category: 'health' }, idem: noteKey });
check('trainer adds a health note', note.status === 201 && note.body.note.category === 'health' && note.body.note.canEdit === true, note.body);
check('retried note is not added twice', (await call('POST', N, { token: trainer.token, body: { text: 'Knee pain on squats; avoid deep squats', category: 'health' }, idem: noteKey })).body.note._id === note.body.note._id);
const deskNote = await call('POST', N, { token: desk.token, body: { text: 'Asked about a refund for last month', category: 'complaint', pinned: true }, idem: key() });
check('front desk adds a pinned complaint', deskNote.status === 201 && deskNote.body.note.pinned === true, deskNote.body);
const badNote = await call('POST', N, { token: desk.token, body: { text: '   ', category: 'gossip' }, idem: key() });
check('note validation (422 on fields)', badNote.status === 422 && fields(badNote).text, badNote.body);

const notes = await call('GET', N, { token: trainer.token });
check('pinned notes come first; counts by category', notes.body.notes?.[0]._id === deskNote.body.note._id && notes.body.counts.health === 1 && notes.body.counts.all === 2, notes.body);
const onlyHealth = await call('GET', `${N}?category=health`, { token: trainer.token });
check('filter by category', onlyHealth.body.notes.length === 1 && onlyHealth.body.total === 1);
check('a note can\'t be reached through another member\'s path (404)', (await call('DELETE', `/admin/members/${priya._id}/notes/${note.body.note._id}`, { token: T })).status === 404);

const edited = await call('PATCH', `${N}/${note.body.note._id}`, { token: trainer.token, body: { text: 'Knee pain on deep squats; box squats are fine' } });
check('author edits their note', edited.status === 200 && edited.body.note.editedAt, edited.body);
check('trainer cannot edit someone else\'s note (403)', (await call('PATCH', `${N}/${deskNote.body.note._id}`, { token: trainer.token, body: { text: 'changed' } })).status === 403);
const unpinned = await call('PATCH', `${N}/${deskNote.body.note._id}`, { token: trainer.token, body: { pinned: false } });
check('anyone with notes access can unpin', unpinned.status === 200 && unpinned.body.note.pinned === false && !unpinned.body.note.editedAt, unpinned.body);
check('trainer cannot delete someone else\'s note (403)', (await call('DELETE', `${N}/${deskNote.body.note._id}`, { token: trainer.token })).status === 403);
check('manager deletes any note', (await call('DELETE', `${N}/${deskNote.body.note._id}`, { token: manager.token })).status === 200);
check('author deletes their own note', (await call('DELETE', `${N}/${note.body.note._id}`, { token: trainer.token })).status === 200);
check('notes are staff-only (member token 403)', (await call('GET', N, { token: raviT })).status === 403);
check('notes on an unknown member are 404', (await call('GET', '/admin/members/5f0000000000000000000000/notes', { token: trainer.token })).status === 404);

finish();
