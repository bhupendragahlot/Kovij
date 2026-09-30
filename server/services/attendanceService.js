/**
 * Attendance: check-in, check-out, QR scans, the desk log, and the day, month and member views.
 *
 * Every write that changes a visit also writes an AttendanceEvent in the same transaction, so the
 * desk log always says who did what, how and when (including undos and refusals). Entry rules
 * live in attendanceRules.js and are the same at the desk, the desk scanner and the kiosk; only
 * a person at the desk can let someone in anyway, and only with a reason.
 */
import Attendance from '../models/Attendance.js';
import AttendanceEvent from '../models/AttendanceEvent.js';
import MemberQrKey from '../models/MemberQrKey.js';
import Member from '../models/Member.js';
import { getSettingsDoc } from '../models/Settings.js';
import { currentMembershipState } from './membershipService.js';
import { createQrToken, looksLikeQrToken, verifyQrToken } from './qrToken.js';
import {
  ATTENDANCE_POLICY,
  addDaysToKey,
  daysBetweenKeys,
  computeStreak,
  decideScanAction,
  evaluateEntry,
  holidayOn,
  hourBuckets,
  isOpenDay,
  isPastClosing,
  membershipSummary,
  minutesBetween,
  monthDays,
  monthOfKey,
  monthsEndingAt,
  openStretchStart,
  storedMembershipStatus,
  toCsv,
  visitMinutes,
  visitStatus,
} from './attendanceRules.js';
import { AppError } from '../middleware/errorHandler.js';
import { toObjectId, withTransaction } from '../utils/db.js';
import { GYM_TZ, gymDayKey, parseGymDay, toGymTime } from '../utils/time.js';
import { escapeRegex } from '../utils/strings.js';

const MEMBER_FIELDS = 'name memberCode phone profilePhoto isActive';
const LIST_MEMBER_FIELDS = 'name memberCode phone profilePhoto';
const STAFF_FIELDS = 'name username';

/** Member fields sent with a check-in result. The kiosk is a shared screen, so it never gets the phone. */
function publicMember(m, { withPhone = true } = {}) {
  return {
    _id: m._id,
    name: m.name,
    memberCode: m.memberCode || null,
    profilePhoto: m.profilePhoto || '',
    ...(withPhone && { phone: m.phone || null }),
  };
}

const actor = (staff) => ({ by: staff?.id, byName: staff?.name || '' });

async function logEvent(event, session) {
  await AttendanceEvent.create([event], session ? { session } : {});
}

async function closingContext(now) {
  const settings = await getSettingsDoc();
  return {
    settings,
    todayKey: gymDayKey(now),
    pastClosing: isPastClosing(now, settings.openingHours),
  };
}

/** A visit as staff see it: status and minutes worked out, nothing guessed. */
export function toStaffVisit(v, ctx) {
  return { ...v, status: visitStatus(v, ctx), durationMinutes: visitMinutes(v) };
}

/** A visit as the member sees it: no staff names or desk notes. */
export function toMemberVisit(v, ctx) {
  return {
    _id: v._id,
    date: v.dayKey,
    checkedInAt: v.checkedInAt,
    checkedOutAt: v.checkedOutAt || null,
    durationMinutes: visitMinutes(v),
    status: visitStatus(v, ctx),
    method: v.method,
    entries: v.entries || 1,
  };
}

// ── Writes ─────────────────────────────────────────────────────────────────

/** Member, plan standing and the entry verdict, loaded once per check-in or scan. */
export async function loadEntrant(memberId, now = new Date()) {
  const member = await Member.findById(memberId).select(MEMBER_FIELDS).lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const standing = await currentMembershipState(member._id);
  const verdict = evaluateEntry({ name: member.name, memberActive: member.isActive, standing });
  return { member, standing, verdict, membership: membershipSummary(standing, now) };
}

/**
 * Check a member in (or back in, after checking out earlier today).
 * One visit per member per day: repeating the request returns the open visit.
 *
 * @param {{ memberId, method: 'desk'|'qr'|'kiosk', override?: boolean, overrideReason?: string, staff, now?: Date, entrant? }} input
 * @returns {{ status: 200|201, alreadyCheckedIn: boolean, returned: boolean, attendance, member, membership }}
 */
export async function checkIn({ memberId, method = 'desk', override = false, overrideReason, staff, now = new Date(), entrant }) {
  const { member, standing, verdict, membership } = entrant || (await loadEntrant(memberId, now));
  const id = member._id;
  const dayKey = gymDayKey(now);
  const result = (extra) => ({ member: publicMember(member, { withPhone: method !== 'kiosk' }), membership, ...extra });

  const existing = await Attendance.findOne({ memberId: id, dayKey }).lean();
  if (existing && !existing.checkedOutAt) {
    return result({ status: 200, alreadyCheckedIn: true, returned: false, attendance: existing });
  }

  if (!verdict.allowed) {
    const canOverride = method !== 'kiosk';
    if (!override || !canOverride) {
      await logEvent({
        type: 'refused',
        memberId: id,
        attendanceId: existing?._id,
        dayKey,
        at: now,
        method,
        ...actor(staff),
        reason: verdict.reason,
        membershipStatus: standing.state,
      });
      throw new AppError(verdict.message, 409, 'MEMBERSHIP_INACTIVE', {
        member: publicMember(member, { withPhone: canOverride }),
        membership,
        reason: verdict.reason,
        canOverride,
      });
    }
    if (!overrideReason) {
      throw new AppError('Add a reason to let this member in without an active plan', 422, 'VALIDATION_ERROR', {
        fields: { overrideReason: 'Add a reason' },
      });
    }
  }
  const reason = verdict.allowed ? '' : overrideReason;

  if (existing) {
    // Came back after checking out: reopen today's visit.
    const reopened = await withTransaction(async (session) => {
      const row = await Attendance.findOneAndUpdate(
        { _id: existing._id, checkedOutAt: { $ne: null } },
        { $set: { checkedOutAt: null, checkOutMethod: null, checkedOutBy: null, lastInAt: now }, $inc: { entries: 1 } },
        { new: true, session }
      ).lean();
      if (!row) return null;
      await logEvent(
        { type: 'returned', memberId: id, attendanceId: row._id, dayKey, at: now, method, ...actor(staff), reason, membershipStatus: standing.state },
        session
      );
      return row;
    });
    if (!reopened) {
      // Another desk reopened it a moment ago.
      const attendance = await Attendance.findById(existing._id).lean();
      return result({ status: 200, alreadyCheckedIn: true, returned: false, attendance });
    }
    return result({ status: 200, alreadyCheckedIn: false, returned: true, attendance: reopened });
  }

  try {
    const attendance = await withTransaction(async (session) => {
      const [row] = await Attendance.create(
        [
          {
            memberId: id,
            dayKey,
            checkedInAt: now,
            lastInAt: now,
            method,
            membershipStatus: storedMembershipStatus(standing.state),
            overrideReason: reason || '',
            recordedBy: staff?.id,
          },
        ],
        { session }
      );
      await logEvent(
        { type: 'check_in', memberId: id, attendanceId: row._id, dayKey, at: now, method, ...actor(staff), reason: reason || '', membershipStatus: standing.state },
        session
      );
      return row.toObject();
    });
    return result({ status: 201, alreadyCheckedIn: false, returned: false, attendance });
  } catch (e) {
    // Two desks tapped at the same moment: the unique index kept one; return it.
    if (e?.code !== 11000) throw e;
    const attendance = await Attendance.findOne({ memberId: id, dayKey }).lean();
    return result({ status: 200, alreadyCheckedIn: true, returned: false, attendance });
  }
}

const TOO_LATE_OUT = 'Only today’s visits can be checked out. Earlier visits without a check-out stay marked “No check-out”.';

/** Record the check-out time (now) on today's open visit. Repeats return the existing check-out. */
export async function checkOut({ attendanceId, visit, method = 'desk', staff, now = new Date() }) {
  const row = visit || (await Attendance.findById(attendanceId).lean());
  if (!row) throw new AppError('Visit not found', 404, 'NOT_FOUND');
  if (row.dayKey !== gymDayKey(now)) throw new AppError(TOO_LATE_OUT, 409, 'TOO_LATE');
  if (row.checkedOutAt) return { alreadyCheckedOut: true, attendance: row };

  const minutes = minutesBetween(openStretchStart(row), now);
  const attendance = await withTransaction(async (session) => {
    const updated = await Attendance.findOneAndUpdate(
      { _id: row._id, checkedOutAt: null },
      { $set: { checkedOutAt: now, checkOutMethod: method, checkedOutBy: staff?.id ?? null }, $inc: { minutesInGym: minutes } },
      { new: true, session }
    ).lean();
    if (!updated) return null;
    await logEvent(
      { type: 'check_out', memberId: row.memberId, attendanceId: row._id, dayKey: row.dayKey, at: now, method, ...actor(staff), details: { minutes } },
      session
    );
    return updated;
  });
  if (!attendance) return { alreadyCheckedOut: true, attendance: await Attendance.findById(row._id).lean() };
  return { alreadyCheckedOut: false, attendance };
}

/** Reverse a mistaken check-out (today only): the member is back "in the gym". */
export async function undoCheckOut({ attendanceId, staff, now = new Date() }) {
  const row = await Attendance.findById(attendanceId).lean();
  if (!row) throw new AppError('Visit not found', 404, 'NOT_FOUND');
  if (row.dayKey !== gymDayKey(now)) throw new AppError('Only today’s check-outs can be undone', 409, 'TOO_LATE');
  if (!row.checkedOutAt) throw new AppError('This visit has no check-out to undo', 409, 'NOT_CHECKED_OUT');

  const minutes = Math.min(minutesBetween(openStretchStart(row), row.checkedOutAt), row.minutesInGym || 0);
  const attendance = await withTransaction(async (session) => {
    const updated = await Attendance.findOneAndUpdate(
      { _id: row._id, checkedOutAt: row.checkedOutAt },
      { $set: { checkedOutAt: null, checkOutMethod: null, checkedOutBy: null }, $inc: { minutesInGym: -minutes } },
      { new: true, session }
    ).lean();
    if (!updated) return null;
    await logEvent(
      {
        type: 'undo_check_out',
        memberId: row.memberId,
        attendanceId: row._id,
        dayKey: row.dayKey,
        at: now,
        method: 'desk',
        ...actor(staff),
        details: { checkedOutAt: row.checkedOutAt },
      },
      session
    );
    return updated;
  });
  if (!attendance) throw new AppError('This visit changed a moment ago. Refresh and try again.', 409, 'CONFLICT');
  return { attendance };
}

/** Remove a mistaken check-in (today only). The desk log keeps a record of the visit and the undo. */
export async function undoCheckIn({ attendanceId, staff, now = new Date() }) {
  const row = await Attendance.findById(attendanceId).lean();
  if (!row) throw new AppError('Check-in not found', 404, 'NOT_FOUND');
  if (row.dayKey !== gymDayKey(now)) throw new AppError('Only today’s check-ins can be undone', 409, 'TOO_LATE');
  const removed = await withTransaction(async (session) => {
    const deleted = await Attendance.findOneAndDelete({ _id: row._id }, { session }).lean();
    if (!deleted) return null;
    await logEvent(
      {
        type: 'undo_check_in',
        memberId: row.memberId,
        attendanceId: row._id,
        dayKey: row.dayKey,
        at: now,
        method: 'desk',
        ...actor(staff),
        details: { checkedInAt: row.checkedInAt, checkedOutAt: row.checkedOutAt || null, method: row.method, entries: row.entries || 1 },
      },
      session
    );
    return deleted;
  });
  if (!removed) throw new AppError('Check-in not found', 404, 'NOT_FOUND');
}

// ── QR codes and scans ─────────────────────────────────────────────────────

const QR_UNKNOWN = () => new AppError('This QR code isn’t a Kovij member code', 404, 'QR_UNKNOWN');

/** A typed member code at the desk: "KFZ-0142", "kfz0142", or just "142" when only one member matches. */
async function findByMemberCode(raw) {
  const code = raw.toUpperCase().replace(/\s+/g, '');
  const withPrefix = /^([A-Z]{1,8})-?(\d{1,8})$/.exec(code);
  if (withPrefix) {
    const [, prefix, digits] = withPrefix;
    const candidates = [...new Set([`${prefix}-${digits}`, `${prefix}-${String(Number(digits)).padStart(4, '0')}`, code])];
    const member = await Member.findOne({ memberCode: { $in: candidates } }).select('_id').lean();
    if (member) return member;
  } else if (/^\d{1,8}$/.test(code)) {
    const matches = await Member.find({ memberCode: new RegExp(`^[A-Z]{1,8}-0*${Number(code)}$`, 'i') })
      .select('_id')
      .limit(2)
      .lean();
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      throw new AppError('More than one member has this number. Type the full code, for example KFZ-0142.', 409, 'AMBIGUOUS_CODE');
    }
  } else {
    // A scanned URL, receipt or other QR code: not ours.
    throw new AppError('This isn’t a Kovij member QR code or member code', 404, 'QR_UNKNOWN');
  }
  throw new AppError(`No member has the code ${code}. Check the code on the member’s card.`, 404, 'MEMBER_CODE_UNKNOWN');
}

/**
 * Turn what was scanned or typed into a member id. The kiosk accepts only signed QR codes; the desk
 * also accepts a typed member code (a person is there to check the face against the profile).
 */
async function resolveCode(raw, { source, staff, now }) {
  const code = String(raw).trim();
  if (looksLikeQrToken(code)) {
    const parsed = verifyQrToken(code);
    if (!parsed.ok) throw QR_UNKNOWN();
    const [member, key] = await Promise.all([
      Member.findById(parsed.memberId).select(LIST_MEMBER_FIELDS).lean(),
      MemberQrKey.findOne({ memberId: parsed.memberId }).lean(),
    ]);
    if (!member) throw QR_UNKNOWN();
    if (parsed.version !== (key?.version || 1)) {
      await logEvent({
        type: 'refused',
        memberId: member._id,
        dayKey: gymDayKey(now),
        at: now,
        method: source === 'kiosk' ? 'kiosk' : 'qr',
        ...actor(staff),
        reason: 'Old QR code',
      });
      throw new AppError(
        'This QR code was replaced by a newer one. Show the latest code in the Kovij app, or ask the desk for a new card.',
        410,
        'QR_REVOKED',
        source === 'kiosk' ? undefined : { member: publicMember(member) }
      );
    }
    return { memberId: member._id, via: 'qr' };
  }
  if (source === 'kiosk') throw QR_UNKNOWN();
  const member = await findByMemberCode(code);
  return { memberId: member._id, via: 'code' };
}

/**
 * A scan at the desk or the kiosk. Checks the member in, or out when they are already in (see
 * decideScanAction), applying the same entry rules as the desk. Refusals throw 409
 * MEMBERSHIP_INACTIVE with `canOverride` false at the kiosk.
 *
 * @returns {{ action: 'checked_in'|'returned'|'checked_out'|'already_in'|'already_out', status, attendance, member, membership }}
 */
export async function scan({ code, mode = 'auto', source = 'desk', staff, now = new Date() }) {
  const found = await resolveCode(code, { source, staff, now });
  const method = source === 'kiosk' ? 'kiosk' : found.via === 'qr' ? 'qr' : 'desk';
  const entrant = await loadEntrant(found.memberId, now);
  const member = publicMember(entrant.member, { withPhone: source !== 'kiosk' });
  const visit = await Attendance.findOne({ memberId: entrant.member._id, dayKey: gymDayKey(now) }).lean();
  const action = decideScanAction(visit, { mode, now });

  if (action === 'check_in' || action === 'return') {
    const r = await checkIn({ memberId: entrant.member._id, method, staff, now, entrant });
    return { ...r, action: r.alreadyCheckedIn ? 'already_in' : r.returned ? 'returned' : 'checked_in' };
  }
  if (action === 'check_out') {
    const r = await checkOut({ visit, method, staff, now });
    return { status: 200, member, membership: entrant.membership, attendance: r.attendance, action: r.alreadyCheckedOut ? 'already_out' : 'checked_out' };
  }
  if (action === 'not_in') {
    throw new AppError(`${entrant.member.name} hasn’t checked in today`, 409, 'NOT_CHECKED_IN', { member, membership: entrant.membership });
  }
  return { status: 200, member, membership: entrant.membership, attendance: visit, action };
}

/** The member's current entry code (what the member app renders as a QR). */
export async function memberQr(memberId) {
  const [member, key] = await Promise.all([
    Member.findById(memberId).select('name memberCode').lean(),
    MemberQrKey.findOne({ memberId }).lean(),
  ]);
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const version = key?.version || 1;
  return {
    token: createQrToken({ memberId: String(member._id), version }),
    version,
    memberCode: member.memberCode || null,
    name: member.name,
    replacedAt: key?.rotatedAt || null,
  };
}

/** Replace a member's QR code: every older code stops working immediately. */
export async function reissueQr({ memberId, reason, staff, now = new Date() }) {
  const member = await Member.findById(memberId).select('name memberCode').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  const key = await withTransaction(async (session) => {
    // Members without a row are on version 1, so create it at 1 before moving it on.
    await MemberQrKey.updateOne({ memberId: member._id }, { $setOnInsert: { version: 1 } }, { upsert: true, session });
    const doc = await MemberQrKey.findOneAndUpdate(
      { memberId: member._id },
      { $inc: { version: 1 }, $set: { rotatedAt: now, rotatedBy: staff?.id, reason: reason || '' } },
      { new: true, session }
    ).lean();
    await logEvent(
      { type: 'qr_reissued', memberId: member._id, dayKey: gymDayKey(now), at: now, method: 'desk', ...actor(staff), reason: reason || '', details: { version: doc.version } },
      session
    );
    return doc;
  });
  return {
    token: createQrToken({ memberId: String(member._id), version: key.version }),
    version: key.version,
    memberCode: member.memberCode || null,
    name: member.name,
    replacedAt: key.rotatedAt,
  };
}

// ── Staff views ────────────────────────────────────────────────────────────

const round1 = (n) => Math.round(n * 10) / 10;
const average = (values) => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);

/** Check-ins per hour averaged over the same weekday in the previous four weeks. */
async function typicalByHour(dayKey) {
  const days = [7, 14, 21, 28].map((d) => addDaysToKey(dayKey, -d));
  const rows = await Attendance.aggregate([
    { $match: { dayKey: { $in: days } } },
    { $group: { _id: { day: '$dayKey', hour: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } } }, n: { $sum: 1 } } },
  ]);
  const daysWithData = new Set(rows.map((r) => r._id.day)).size;
  const perHour = new Map();
  for (const r of rows) perHour.set(r._id.hour, (perHour.get(r._id.hour) || 0) + r.n);
  return hourBuckets([...perHour].map(([hour, n]) => ({ _id: hour, n })), Math.max(1, daysWithData));
}

/**
 * One day at the desk: visits with in/out times, who recorded them and how, per-hour counts
 * against a typical same weekday, and the desk log.
 */
export async function dayView({ date, memberId, now = new Date() }) {
  const ctx = await closingContext(now);
  const day = date || ctx.todayKey;
  const isToday = day === ctx.todayKey;
  const visitCtx = { todayKey: ctx.todayKey, pastClosing: isToday && ctx.pastClosing };
  const match = { dayKey: day, ...(memberId && { memberId: toObjectId(memberId) }) };

  const [visits, hourRows, typical, events] = await Promise.all([
    Attendance.find(match)
      .sort({ checkedInAt: -1 })
      .populate('memberId', LIST_MEMBER_FIELDS)
      .populate('recordedBy', STAFF_FIELDS)
      .populate('checkedOutBy', STAFF_FIELDS)
      .lean(),
    Attendance.aggregate([{ $match: match }, { $group: { _id: { $hour: { date: '$checkedInAt', timezone: GYM_TZ } }, n: { $sum: 1 } } }]),
    memberId ? null : typicalByHour(day),
    AttendanceEvent.find(match).sort({ at: -1 }).limit(500).populate('memberId', 'name memberCode').lean(),
  ]);

  const items = visits.filter((v) => v.memberId).map((v) => toStaffVisit(v, visitCtx));
  const hours = hourBuckets(hourRows).map((h) => ({ ...h, typical: typical ? typical[h.hour].count : 0 }));
  const count = (fn) => items.filter(fn).length;

  return {
    date: day,
    isToday,
    pastClosing: visitCtx.pastClosing,
    total: items.length,
    summary: {
      visits: items.length,
      inGym: count((v) => v.status === 'in'),
      checkedOut: count((v) => v.status === 'out'),
      noCheckOut: count((v) => v.status === 'no_check_out'),
      letInOnce: count((v) => v.membershipStatus !== 'active'),
      averageMinutes: average(items.map((v) => v.durationMinutes).filter((m) => m != null)),
      byMethod: { desk: count((v) => v.method === 'desk'), qr: count((v) => v.method === 'qr'), kiosk: count((v) => v.method === 'kiosk') },
    },
    items,
    byHour: hours,
    events: events.map((e) => ({
      _id: e._id,
      type: e.type,
      at: e.at,
      method: e.method,
      member: e.memberId ? { _id: e.memberId._id, name: e.memberId.name, memberCode: e.memberId.memberCode || null } : null,
      byName: e.byName,
      reason: e.reason,
      details: e.details,
    })),
  };
}

/** Gym-wide month: visits per calendar day (for the heatmap) and headline totals. */
export async function monthView({ month, now = new Date() }) {
  const days = monthDays(month);
  const [settings, perDay, members] = await Promise.all([
    getSettingsDoc(),
    Attendance.aggregate([{ $match: { dayKey: { $in: days } } }, { $group: { _id: '$dayKey', n: { $sum: 1 } } }]),
    Attendance.distinct('memberId', { dayKey: { $in: days } }),
  ]);
  const todayKey = gymDayKey(now);
  const counts = new Map(perDay.map((r) => [r._id, r.n]));
  const rows = days.map((date) => ({
    date,
    visits: counts.get(date) || 0,
    open: isOpenDay(date, settings),
    holiday: holidayOn(date, settings.holidays)?.name || null,
    future: daysBetweenKeys(todayKey, date) > 0,
  }));
  const visits = rows.reduce((sum, d) => sum + d.visits, 0);
  const openSoFar = rows.filter((d) => !d.future && (d.open || d.visits > 0)).length;
  const busiest = rows.reduce((best, d) => (d.visits > (best?.visits || 0) ? d : best), null);
  return {
    month,
    days: rows,
    totals: {
      visits,
      members: members.length,
      averagePerOpenDay: openSoFar ? round1(visits / openSoFar) : 0,
      busiestDay: busiest ? { date: busiest.date, visits: busiest.visits } : null,
    },
  };
}

/** Per-member visit counts for a month, most visits first. */
export async function monthMembers({ month, q, page = 1, limit = 25, all = false }) {
  const rx = q ? new RegExp(escapeRegex(q), 'i') : null;
  const pipeline = [
    { $match: { dayKey: { $in: monthDays(month) } } },
    {
      $group: {
        _id: '$memberId',
        visits: { $sum: 1 },
        lastVisitAt: { $max: '$checkedInAt' },
        timedMinutes: { $sum: { $cond: [{ $ifNull: ['$checkedOutAt', false] }, '$minutesInGym', 0] } },
        timedVisits: { $sum: { $cond: [{ $ifNull: ['$checkedOutAt', false] }, 1, 0] } },
      },
    },
    { $lookup: { from: Member.collection.name, localField: '_id', foreignField: '_id', as: 'member' } },
    { $unwind: '$member' },
    ...(rx ? [{ $match: { $or: [{ 'member.name': rx }, { 'member.memberCode': rx }] } }] : []),
    { $sort: { visits: -1, lastVisitAt: -1, _id: 1 } },
    {
      $project: {
        _id: 0,
        member: { _id: '$member._id', name: '$member.name', memberCode: '$member.memberCode', profilePhoto: '$member.profilePhoto' },
        visits: 1,
        lastVisitAt: 1,
        averageMinutes: { $cond: [{ $gt: ['$timedVisits', 0] }, { $round: [{ $divide: ['$timedMinutes', '$timedVisits'] }, 0] }, null] },
      },
    },
  ];
  if (all) return Attendance.aggregate(pipeline);
  const [result] = await Attendance.aggregate([
    ...pipeline,
    { $facet: { items: [{ $skip: (page - 1) * limit }, { $limit: limit }], total: [{ $count: 'n' }] } },
  ]);
  return { items: result.items, total: result.total[0]?.n || 0, page, limit };
}

const METHOD_LABEL = { desk: 'Desk', qr: 'QR at desk', kiosk: 'Kiosk', self: 'Self' };
const STATUS_LABEL = { in: 'In gym', out: 'Checked out', no_check_out: 'No check-out' };
const clock = (d) => (d ? toGymTime(d).format('HH:mm') : '');
const staffName = (u) => (u ? u.name || u.username || '' : '');

/** CSV for a month: one row per visit, or one row per member with their visit count. */
export async function exportMonthCsv({ month, kind = 'visits', now = new Date() }) {
  if (kind === 'members') {
    const rows = await monthMembers({ month, all: true });
    return toCsv(
      [
        { header: 'Member code', value: (r) => r.member.memberCode },
        { header: 'Name', value: (r) => r.member.name },
        { header: 'Visits', value: (r) => r.visits },
        { header: 'Last visit', value: (r) => gymDayKey(r.lastVisitAt) },
        { header: 'Average minutes per visit', value: (r) => r.averageMinutes },
      ],
      rows
    );
  }
  const ctx = await closingContext(now);
  const visits = await Attendance.find({ dayKey: { $in: monthDays(month) } })
    .sort({ dayKey: 1, checkedInAt: 1 })
    .populate('memberId', 'name memberCode')
    .populate('recordedBy', STAFF_FIELDS)
    .populate('checkedOutBy', STAFF_FIELDS)
    .lean();
  const rows = visits.filter((v) => v.memberId).map((v) => toStaffVisit(v, { todayKey: ctx.todayKey, pastClosing: ctx.pastClosing }));
  return toCsv(
    [
      { header: 'Date', value: (v) => v.dayKey },
      { header: 'Member code', value: (v) => v.memberId.memberCode },
      { header: 'Name', value: (v) => v.memberId.name },
      { header: 'Checked in', value: (v) => clock(v.checkedInAt) },
      { header: 'Checked out', value: (v) => clock(v.checkedOutAt) },
      { header: 'Minutes in gym', value: (v) => v.durationMinutes },
      { header: 'Status', value: (v) => STATUS_LABEL[v.status] },
      { header: 'Checked in by', value: (v) => `${METHOD_LABEL[v.method] || v.method}${staffName(v.recordedBy) ? `, ${staffName(v.recordedBy)}` : ''}` },
      { header: 'Checked out by', value: (v) => (v.checkedOutAt ? `${METHOD_LABEL[v.checkOutMethod] || ''}${staffName(v.checkedOutBy) ? `, ${staffName(v.checkedOutBy)}` : ''}` : '') },
      { header: 'Let in once', value: (v) => (v.membershipStatus !== 'active' ? v.overrideReason || 'Yes' : '') },
    ],
    rows
  );
}

// ── One member (staff profile tab and member app) ──────────────────────────

export async function ensureMember(memberId) {
  const member = await Member.findById(memberId).select('name memberCode').lean();
  if (!member) throw new AppError('Member not found', 404, 'NOT_FOUND');
  return member;
}

/**
 * Headline numbers for one member: visits in the last 30 days and this month, streaks, average
 * visit length, last visit, and visits per month for the last 12 months.
 */
export async function memberStats(memberId, now = new Date()) {
  const policy = ATTENDANCE_POLICY;
  const [ctx, total] = await Promise.all([closingContext(now), Attendance.countDocuments({ memberId })]);
  const { todayKey, settings } = ctx;
  const since = parseGymDay(addDaysToKey(todayKey, -(policy.streakLookbackDays - 1))).toDate();
  const recent = await Attendance.find({ memberId, checkedInAt: { $gte: since } })
    .select('dayKey checkedInAt checkedOutAt minutesInGym')
    .sort({ dayKey: -1 })
    .lean();

  const last30From = addDaysToKey(todayKey, -29);
  const thisMonth = monthOfKey(todayKey);
  const months = monthsEndingAt(thisMonth, policy.trendMonths);
  const perMonth = new Map(months.map((m) => [m, 0]));
  for (const v of recent) {
    const m = monthOfKey(v.dayKey);
    if (perMonth.has(m)) perMonth.set(m, perMonth.get(m) + 1);
  }
  const visited = new Set(recent.map((v) => v.dayKey));
  const lastVisit = recent[0] || (total ? await Attendance.findOne({ memberId }).sort({ dayKey: -1 }).select('checkedInAt').lean() : null);

  return {
    last30Days: recent.filter((v) => daysBetweenKeys(last30From, v.dayKey) >= 0).length,
    thisMonth: perMonth.get(thisMonth) || 0,
    total,
    lastVisitAt: lastVisit?.checkedInAt || null,
    averageMinutes: average(recent.map(visitMinutes).filter((m) => m != null)),
    streak: computeStreak(visited, { todayKey, isOpen: (key) => isOpenDay(key, settings), lookbackDays: policy.streakLookbackDays }),
    trend: months.map((month) => ({ month, visits: perMonth.get(month) })),
  };
}

/** A member's month as a calendar: every day, whether the gym was open, and the visit if any. */
export async function memberMonth(memberId, { month, staffView = false, now = new Date() }) {
  const days = monthDays(month);
  const [ctx, visits] = await Promise.all([closingContext(now), Attendance.find({ memberId, dayKey: { $in: days } }).lean()]);
  const { settings, todayKey } = ctx;
  const byDay = new Map(visits.map((v) => [v.dayKey, v]));
  const shape = staffView ? toStaffVisit : toMemberVisit;
  const past = (date) => daysBetweenKeys(todayKey, date) <= 0;
  return {
    month,
    daysVisited: visits.length,
    openDays: days.filter((d) => past(d) && isOpenDay(d, settings)).length,
    days: days.map((date) => {
      const v = byDay.get(date);
      return {
        date,
        open: isOpenDay(date, settings),
        holiday: holidayOn(date, settings.holidays)?.name || null,
        future: !past(date),
        visit: v ? shape(v, { todayKey, pastClosing: date === todayKey && ctx.pastClosing }) : null,
      };
    }),
  };
}

/** A member's visits, newest first. */
export async function memberHistory(memberId, { page = 1, limit = 25, staffView = false, now = new Date() }) {
  let query = Attendance.find({ memberId })
    .sort({ dayKey: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
  if (staffView) query = query.populate('recordedBy', STAFF_FIELDS).populate('checkedOutBy', STAFF_FIELDS);
  const [ctx, rows, total] = await Promise.all([closingContext(now), query.lean(), Attendance.countDocuments({ memberId })]);
  const shape = staffView ? toStaffVisit : toMemberVisit;
  const items = rows.map((v) => shape(v, { todayKey: ctx.todayKey, pastClosing: v.dayKey === ctx.todayKey && ctx.pastClosing }));
  return { items, total, page, limit };
}

/** Is the member in the gym right now? */
export async function memberToday(memberId, now = new Date()) {
  const [ctx, visit] = await Promise.all([closingContext(now), Attendance.findOne({ memberId, dayKey: gymDayKey(now) }).lean()]);
  const visitCtx = { todayKey: ctx.todayKey, pastClosing: ctx.pastClosing };
  return {
    date: ctx.todayKey,
    status: visit ? visitStatus(visit, visitCtx) : 'not_in',
    visit: visit ? toMemberVisit(visit, visitCtx) : null,
  };
}
