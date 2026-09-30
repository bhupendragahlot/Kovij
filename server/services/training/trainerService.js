/**
 * Trainer profiles, their link to a staff login, the members they coach, and how that
 * coaching is going. Member.assignedTrainerId is only ever written here.
 */
import Trainer from '../../models/Trainer.js';
import Member from '../../models/Member.js';
import Membership from '../../models/Membership.js';
import Attendance from '../../models/Attendance.js';
import User from '../../models/User.js';
import WorkoutAssignment from '../../models/WorkoutAssignment.js';
import WorkoutLog from '../../models/WorkoutLog.js';
import { getSettingsDoc } from '../../models/Settings.js';
import { memberSearchFilter } from '../memberService.js';
import { AppError } from '../../middleware/errorHandler.js';
import { canonicalPhone } from '../../utils/strings.js';
import { startOfGymDay, toGymTime } from '../../utils/time.js';
import { toObjectId } from '../../utils/db.js';
import { memberStanding, normalizeSchedule, standingFromStatuses, summarizeSchedule, summarizeTrainerPerformance } from './math.js';

const notFound = () => new AppError('Trainer not found', 404, 'NOT_FOUND');

/** Start of the gym day 29 days ago: "the last 30 days" including today. */
export const last30Start = (now = new Date()) => startOfGymDay(toGymTime(now).subtract(29, 'day'));

// ── Profiles ───────────────────────────────────────────────────────────────

/** Staff view of a trainer: schedule summary and linked login attached. */
function present(trainer, { user, memberCount } = {}) {
  const schedule = normalizeSchedule(trainer.schedule || []);
  return {
    ...trainer,
    schedule,
    scheduleText: summarizeSchedule(schedule) || trainer.shift || '',
    user: user ? { id: String(user._id), name: user.name || user.username, username: user.username, isActive: user.isActive !== false } : null,
    ...(memberCount !== undefined && { memberCount }),
  };
}

export async function listTrainers() {
  const trainers = await Trainer.find().sort({ isActive: -1, createdAt: 1 }).lean();
  const ids = trainers.map((t) => t._id);
  const [users, counts] = await Promise.all([
    User.find({ _id: { $in: trainers.map((t) => t.userId).filter(Boolean) } }).select('name username isActive').lean(),
    Member.aggregate([{ $match: { assignedTrainerId: { $in: ids } } }, { $group: { _id: '$assignedTrainerId', n: { $sum: 1 } } }]),
  ]);
  const userById = new Map(users.map((u) => [String(u._id), u]));
  const countById = new Map(counts.map((c) => [String(c._id), c.n]));
  return trainers.map((t) => present(t, { user: t.userId && userById.get(String(t.userId)), memberCount: countById.get(String(t._id)) || 0 }));
}

export async function getTrainer(id) {
  const trainer = await Trainer.findById(id).lean();
  if (!trainer) throw notFound();
  const [user, memberCount] = await Promise.all([
    trainer.userId ? User.findById(trainer.userId).select('name username isActive').lean() : null,
    Member.countDocuments({ assignedTrainerId: trainer._id }),
  ]);
  return present(trainer, { user, memberCount });
}

/** The trainer profile linked to a staff login, or null. */
export async function trainerForUser(userId) {
  if (!userId) return null;
  const trainer = await Trainer.findOne({ userId }).lean();
  return trainer ? present(trainer) : null;
}

/** Only an existing staff login with the trainer role, not linked to another profile. */
async function assertLinkable(userId, trainerId) {
  const user = await User.findById(userId).select('role name username').lean();
  if (!user) {
    throw new AppError('That staff login no longer exists', 422, 'VALIDATION_ERROR', { fields: { userId: 'Choose a login from the list' } });
  }
  if (user.role !== 'trainer') {
    throw new AppError('Only a staff login with the trainer role can be linked', 422, 'VALIDATION_ERROR', {
      fields: { userId: 'Choose a login with the trainer role' },
    });
  }
  const other = await Trainer.findOne({ userId, ...(trainerId && { _id: { $ne: trainerId } }) }).select('name').lean();
  if (other) {
    throw new AppError(`This login is already linked to ${other.name}`, 409, 'LOGIN_ALREADY_LINKED', {
      fields: { userId: `Already linked to ${other.name}` },
    });
  }
}

function cleanInput(input) {
  const out = { ...input };
  if (out.phone !== undefined) out.phone = canonicalPhone(out.phone) || '';
  if (out.schedule) out.schedule = normalizeSchedule(out.schedule);
  return out;
}

export async function createTrainer(input) {
  const { userId, ...fields } = cleanInput(input);
  if (userId) await assertLinkable(userId);
  const trainer = await Trainer.create({ ...fields, ...(userId && { userId }) });
  return getTrainer(trainer._id);
}

export async function updateTrainer(id, patch) {
  const { userId, ...fields } = cleanInput(patch);
  const exists = await Trainer.exists({ _id: id });
  if (!exists) throw notFound();
  const update = { $set: fields };
  if (userId === null) update.$unset = { userId: 1 };
  else if (userId) {
    await assertLinkable(userId, id);
    update.$set.userId = userId;
  }
  // Clearing optional text sends "" (optionalText turns it into undefined): store it as empty.
  for (const key of ['image', 'instagram', 'description', 'phone', 'email', 'shift']) {
    if (key in patch && patch[key] === undefined) update.$set[key] = '';
  }
  await Trainer.updateOne({ _id: id }, update, { runValidators: true });
  return getTrainer(id);
}

export async function setTrainerPhoto(id, imagePath) {
  const trainer = await Trainer.findByIdAndUpdate(id, { $set: { image: imagePath } }, { new: true });
  if (!trainer) throw notFound();
  return getTrainer(id);
}

/** A trainer who still coaches members can't be deleted; move the members or mark them inactive. */
export async function removeTrainer(id) {
  const trainer = await Trainer.findById(id).select('name').lean();
  if (!trainer) throw notFound();
  const members = await Member.countDocuments({ assignedTrainerId: id });
  if (members) {
    throw new AppError(
      `${trainer.name} still coaches ${members} ${members === 1 ? 'member' : 'members'}. Move them to another trainer first, or turn off "Currently working here".`,
      409,
      'TRAINER_HAS_MEMBERS',
      { members }
    );
  }
  await Trainer.deleteOne({ _id: id });
  return { name: trainer.name };
}

/** Staff logins that can be linked to a trainer profile, with what each is linked to now. */
export async function linkableLogins() {
  const [users, linked] = await Promise.all([
    User.find({ role: 'trainer' }).select('name username email isActive').sort({ name: 1, username: 1 }).lean(),
    Trainer.find({ userId: { $exists: true } }).select('name userId').lean(),
  ]);
  const byUser = new Map(linked.map((t) => [String(t.userId), t]));
  return users.map((u) => ({
    id: String(u._id),
    name: u.name || u.username,
    username: u.username,
    email: u.email,
    isActive: u.isActive !== false,
    linkedTrainer: byUser.has(String(u._id)) ? { id: String(byUser.get(String(u._id))._id), name: byUser.get(String(u._id)).name } : null,
  }));
}

// ── Members ────────────────────────────────────────────────────────────────

export async function assignMembers(trainerId, memberIds) {
  const trainer = await Trainer.findById(trainerId).select('name isActive').lean();
  if (!trainer) throw notFound();
  if (trainer.isActive === false) {
    throw new AppError(`${trainer.name} is marked as not working here. Change that first to assign members.`, 409, 'TRAINER_INACTIVE');
  }
  const found = await Member.find({ _id: { $in: memberIds } }).select('assignedTrainerId').lean();
  if (found.length !== memberIds.length) {
    const have = new Set(found.map((m) => String(m._id)));
    throw new AppError('Some members were not found. Refresh and try again.', 404, 'MEMBER_NOT_FOUND', {
      missing: memberIds.filter((id) => !have.has(String(id))),
    });
  }
  const moved = found.filter((m) => m.assignedTrainerId && String(m.assignedTrainerId) !== String(trainerId)).length;
  const res = await Member.updateMany({ _id: { $in: memberIds } }, { $set: { assignedTrainerId: trainer._id } });
  return { trainer: { id: String(trainer._id), name: trainer.name }, assigned: memberIds.length, changed: res.modifiedCount, moved };
}

export async function unassignMember(trainerId, memberId) {
  const trainer = await Trainer.findById(trainerId).select('name').lean();
  if (!trainer) throw notFound();
  const res = await Member.updateOne({ _id: memberId, assignedTrainerId: trainerId }, { $unset: { assignedTrainerId: 1 } });
  if (!res.matchedCount) throw new AppError(`This member isn't assigned to ${trainer.name}`, 404, 'NOT_ASSIGNED');
  return { trainer: { id: String(trainer._id), name: trainer.name } };
}

/**
 * Coaching view of members: membership standing, trainer, current workout plan, last session
 * and visits in the last 30 days. Used by trainer member lists and the workouts roster.
 */
export async function decorateMembers(members, now = new Date()) {
  if (!members.length) return [];
  const ids = members.map((m) => m._id);
  const trainerIds = [...new Set(members.map((m) => m.assignedTrainerId && String(m.assignedTrainerId)).filter(Boolean))];
  const since = last30Start(now);
  const [settings, memberships, assignments, lastLogs, visits, trainers] = await Promise.all([
    getSettingsDoc(),
    Membership.find({ memberId: { $in: ids } }).select('memberId status startDate endDate planName').lean(),
    WorkoutAssignment.find({ memberId: { $in: ids }, status: 'active' }).select('memberId name startDay days.name').lean(),
    WorkoutLog.aggregate([
      { $match: { memberId: { $in: ids } } },
      { $sort: { performedAt: -1 } },
      { $group: { _id: '$memberId', dayKey: { $first: '$dayKey' }, sessions: { $sum: 1 } } },
    ]),
    Attendance.aggregate([{ $match: { memberId: { $in: ids }, checkedInAt: { $gte: since } } }, { $group: { _id: '$memberId', n: { $sum: 1 } } }]),
    Trainer.find({ _id: { $in: trainerIds } }).select('name image').lean(),
  ]);
  const group = (rows) => rows.reduce((map, r) => map.set(String(r.memberId), [...(map.get(String(r.memberId)) || []), r]), new Map());
  const msBy = group(memberships);
  const planBy = new Map(assignments.map((a) => [String(a.memberId), a]));
  const logBy = new Map(lastLogs.map((l) => [String(l._id), l]));
  const visitBy = new Map(visits.map((v) => [String(v._id), v.n]));
  const trainerBy = new Map(trainers.map((t) => [String(t._id), t]));

  return members.map((m) => {
    const id = String(m._id);
    const { state, current } = memberStanding(msBy.get(id) || [], now, settings.expiringWindowDays || 7);
    const plan = planBy.get(id);
    const trainer = m.assignedTrainerId && trainerBy.get(String(m.assignedTrainerId));
    return {
      _id: m._id,
      name: m.name,
      memberCode: m.memberCode,
      phone: m.phone,
      profilePhoto: m.profilePhoto,
      state,
      membership: current ? { planName: current.planName, endDate: current.endDate } : null,
      trainer: trainer ? { _id: trainer._id, name: trainer.name, image: trainer.image } : null,
      workout: plan ? { assignmentId: plan._id, name: plan.name, startDay: plan.startDay, dayCount: plan.days.length } : null,
      lastSessionDay: logBy.get(id)?.dayKey || null,
      sessions: logBy.get(id)?.sessions || 0,
      visits30: visitBy.get(id) || 0,
    };
  });
}

const MEMBER_LIST_FIELDS = 'name memberCode phone profilePhoto assignedTrainerId';

/**
 * One page of members for coaching screens.
 * @param {{ trainerId?: string|null|'none', plan?: 'all'|'on_plan'|'no_plan', q?: string, page: number, limit: number }} opts
 *   trainerId: a trainer's members; 'none' = members without a trainer; undefined = everyone.
 */
export async function coachingRoster({ trainerId, plan = 'all', q, page, limit }) {
  const base = { ...memberSearchFilter(q) };
  if (trainerId === 'none') base.assignedTrainerId = { $exists: false };
  else if (trainerId) base.assignedTrainerId = toObjectId(trainerId);

  const onPlanIds = await WorkoutAssignment.distinct('memberId', { status: 'active' });
  const filter = { ...base };
  if (plan === 'on_plan') filter._id = { $in: onPlanIds };
  if (plan === 'no_plan') filter._id = { $nin: onPlanIds };

  const [members, total, all, onPlan] = await Promise.all([
    Member.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .select(MEMBER_LIST_FIELDS)
      .lean(),
    Member.countDocuments(filter),
    Member.countDocuments(base),
    Member.countDocuments({ ...base, _id: { $in: onPlanIds } }),
  ]);
  return {
    items: await decorateMembers(members),
    total,
    page,
    limit,
    counts: { all, on_plan: onPlan, no_plan: all - onPlan },
  };
}

// ── Performance ────────────────────────────────────────────────────────────

/**
 * Coaching numbers per trainer: members, how many are active or lapsed, how many are on a
 * workout plan, average visits per member and sessions logged in the last 30 days.
 */
export async function trainerPerformance(trainerIds, now = new Date()) {
  const ids = trainerIds.map((id) => toObjectId(id));
  const members = await Member.find({ assignedTrainerId: { $in: ids } }).select('assignedTrainerId').lean();
  const memberIds = members.map((m) => m._id);
  const since = last30Start(now);
  const [statuses, visits, onPlan, sessions] = await Promise.all([
    Membership.aggregate([{ $match: { memberId: { $in: memberIds } } }, { $group: { _id: '$memberId', statuses: { $addToSet: '$status' } } }]),
    Attendance.aggregate([{ $match: { memberId: { $in: memberIds }, checkedInAt: { $gte: since } } }, { $group: { _id: '$memberId', n: { $sum: 1 } } }]),
    WorkoutAssignment.distinct('memberId', { memberId: { $in: memberIds }, status: 'active' }),
    WorkoutLog.aggregate([{ $match: { memberId: { $in: memberIds }, performedAt: { $gte: since } } }, { $group: { _id: '$memberId', n: { $sum: 1 } } }]),
  ]);
  const statusBy = new Map(statuses.map((s) => [String(s._id), s.statuses]));
  const visitBy = new Map(visits.map((v) => [String(v._id), v.n]));
  const sessionBy = new Map(sessions.map((s) => [String(s._id), s.n]));
  const planSet = new Set(onPlan.map(String));
  const rows = members.map((m) => ({
    trainerId: String(m.assignedTrainerId),
    standing: standingFromStatuses(statusBy.get(String(m._id)) || []),
    visits30: visitBy.get(String(m._id)) || 0,
    onPlan: planSet.has(String(m._id)),
    sessions30: sessionBy.get(String(m._id)) || 0,
  }));
  return summarizeTrainerPerformance(trainerIds.map(String), rows);
}

// ── Member app ─────────────────────────────────────────────────────────────

/** WhatsApp and phone links for a stored number (Indian numbers get +91). */
export function contactLinks(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.length < 7) return null;
  const intl = digits.length === 10 ? `91${digits}` : digits;
  return { phone: digits.length === 10 ? digits : `+${intl}`, telUrl: `tel:+${intl}`, whatsappUrl: `https://wa.me/${intl}` };
}

/**
 * The member's own assigned trainer, with contact links. Other members' trainers and other
 * trainers' phone numbers are never exposed to members.
 */
export async function trainerForMember(memberId) {
  const member = await Member.findById(memberId).select('assignedTrainerId').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  if (!member.assignedTrainerId) return null;
  const t = await Trainer.findById(member.assignedTrainerId).lean();
  if (!t || t.isActive === false) return null;
  const schedule = normalizeSchedule(t.schedule || []);
  return {
    _id: t._id,
    name: t.name,
    title: t.role,
    image: t.image || '',
    bio: t.description || '',
    specialties: t.specialties || [],
    instagram: t.instagram || '',
    schedule,
    scheduleText: summarizeSchedule(schedule) || t.shift || '',
    contact: contactLinks(t.phone),
  };
}
