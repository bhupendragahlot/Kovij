/**
 * Body progress: measurement entries (weight, body fat, tape measurements) and the summary the
 * member and their trainer look at. BMI is computed here from weight and height; height comes
 * from the entry, else the member's profile, else their last entry.
 *
 * Health data: never logged. Routes decide who may read it (members.health.view or the member).
 */
import BodyMeasurement from '../models/BodyMeasurement.js';
import MemberProfile from '../models/MemberProfile.js';
import { AppError } from '../middleware/errorHandler.js';
import { withTransaction } from '../utils/db.js';
import { gymDayKey } from '../utils/time.js';
import { BODY_FIELDS, annotateEntries, computeBmi, dayBounds, dayOffset, progressSummary } from './wellnessMath.js';

export const PROGRESS_POLICY = {
  maxEntries: 1000, // per member; years of weekly check-ins
  backdateDays: 365, // an old paper record can be entered up to a year back
};

const EDITABLE = ['weightKg', 'heightCm', ...BODY_FIELDS.slice(1), 'notes'];

const ENTRY_FIELDS = '_id day takenAt weightKg heightCm bmi bodyFatPct chestCm waistCm hipsCm bicepsCm thighsCm neckCm calvesCm notes recordedByKind recordedBy recordedByName createdAt updatedAt';

function presentEntry(e) {
  const out = { _id: e._id, day: e.day || gymDayKey(e.takenAt), takenAt: e.takenAt };
  for (const f of ['weightKg', 'heightCm', 'bmi', ...BODY_FIELDS.slice(1)]) out[f] = typeof e[f] === 'number' ? e[f] : null;
  out.notes = e.notes || '';
  out.recordedByKind = e.recordedByKind || 'staff';
  out.recordedByName = e.recordedByName || '';
  out.recordedBy = e.recordedBy || null;
  out.createdAt = e.createdAt;
  out.updatedAt = e.updatedAt;
  return out;
}

function assertDay(day, now) {
  const offset = dayOffset(day, now);
  if (offset > 0) throw new AppError("You can't record a day that hasn't happened yet", 422, 'VALIDATION_ERROR', { fields: { day: 'Choose today or an earlier date' } });
  if (offset < -PROGRESS_POLICY.backdateDays) {
    throw new AppError('Choose a date within the last year', 422, 'VALIDATION_ERROR', { fields: { day: 'Choose a date within the last year' } });
  }
}

/** Height to use for a new entry: profile first (what the desk recorded), then the last entry. */
export async function defaultHeight(memberId, session) {
  const profile = await MemberProfile.findOne({ memberId }).select('heightCm').session(session || null).lean();
  if (profile?.heightCm > 0) return profile.heightCm;
  const last = await BodyMeasurement.findOne({ memberId, heightCm: { $gt: 0 } }).sort({ takenAt: -1 }).select('heightCm').session(session || null).lean();
  return last?.heightCm || null;
}

/** All entries (newest first, each with change since previous and since first) and the summary. */
export async function progressOverview(memberId, { limit = 200 } = {}) {
  const [rows, heightCm] = await Promise.all([
    BodyMeasurement.find({ memberId }).sort({ takenAt: 1, _id: 1 }).select(ENTRY_FIELDS).lean(),
    defaultHeight(memberId),
  ]);
  const entries = rows.map(presentEntry);
  const annotated = annotateEntries(entries);
  return {
    summary: progressSummary(entries, { heightCm }),
    entries: annotated.reverse().slice(0, limit),
    total: entries.length,
    defaults: { heightCm },
  };
}

/**
 * Keep the profile's weight, height and BMI in step with the newest entry, so the profile's
 * health card never shows stale numbers.
 */
async function syncProfile(memberId, session) {
  const latest = await BodyMeasurement.findOne({ memberId, weightKg: { $gt: 0 } }).sort({ takenAt: -1, _id: -1 }).session(session).lean();
  if (!latest) return;
  const set = { weightKg: latest.weightKg };
  if (latest.heightCm) set.heightCm = latest.heightCm;
  if (latest.bmi) set.bmi = latest.bmi;
  await MemberProfile.updateOne({ memberId }, { $set: set, $setOnInsert: { memberId } }, { upsert: true, session });
}

export async function addEntry({ memberId, data, actor, now = new Date() }) {
  const day = data.day || gymDayKey(now);
  assertDay(day, now);

  const existing = await BodyMeasurement.findOne({ memberId, day }).select('_id').lean();
  if (existing) {
    throw new AppError('There is already an entry for this date. Edit that entry instead.', 409, 'ENTRY_EXISTS', { entryId: String(existing._id), fields: { day: 'This date already has an entry' } });
  }
  const count = await BodyMeasurement.countDocuments({ memberId });
  if (count >= PROGRESS_POLICY.maxEntries) throw new AppError('This member has reached the limit of progress entries', 409, 'TOO_MANY_ENTRIES');

  let entry;
  try {
    entry = await withTransaction(async (session) => {
      const heightCm = data.heightCm ?? (await defaultHeight(memberId, session));
      const doc = { memberId, day, takenAt: dayBounds(day).start, notes: data.notes || '' };
      for (const f of EDITABLE) if (f !== 'notes' && data[f] != null) doc[f] = data[f];
      if (heightCm) doc.heightCm = heightCm;
      const bmi = computeBmi(doc.weightKg, doc.heightCm);
      if (bmi) doc.bmi = bmi;
      Object.assign(doc, { recordedByKind: actor.kind, recordedBy: actor.id, recordedByName: actor.name || '' });
      const [created] = await BodyMeasurement.create([doc], { session });
      await syncProfile(memberId, session);
      return created.toObject();
    });
  } catch (e) {
    // Two saves for the same day at once: the unique index lets one through.
    if (e?.code === 11000) throw new AppError('There is already an entry for this date. Edit that entry instead.', 409, 'ENTRY_EXISTS', { fields: { day: 'This date already has an entry' } });
    throw e;
  }
  return presentEntry(entry);
}

/** Members may change only entries they recorded themselves; staff may change any. */
async function findEditable(memberId, entryId, actor) {
  const entry = await BodyMeasurement.findOne({ _id: entryId, memberId }).lean();
  if (!entry) throw new AppError('Entry not found', 404, 'NOT_FOUND');
  if (actor.kind === 'member' && !(entry.recordedByKind === 'member' && String(entry.recordedBy) === String(actor.id))) {
    throw new AppError('This entry was recorded by your trainer. Ask them to change it.', 403, 'FORBIDDEN');
  }
  return entry;
}

export async function updateEntry({ memberId, entryId, patch, actor, now = new Date() }) {
  const entry = await findEditable(memberId, entryId, actor);
  const set = {};
  const unset = {};
  for (const f of EDITABLE) {
    if (patch[f] === undefined) continue;
    if (patch[f] === null) unset[f] = '';
    else set[f] = patch[f];
  }
  if (patch.day && patch.day !== entry.day) {
    assertDay(patch.day, now);
    const clash = await BodyMeasurement.exists({ memberId, day: patch.day, _id: { $ne: entry._id } });
    if (clash) throw new AppError('There is already an entry for that date', 409, 'ENTRY_EXISTS', { fields: { day: 'This date already has an entry' } });
    set.day = patch.day;
    set.takenAt = dayBounds(patch.day).start;
  }

  const merged = { ...entry, ...set };
  for (const f of Object.keys(unset)) delete merged[f];
  if (!BODY_FIELDS.some((f) => typeof merged[f] === 'number')) {
    throw new AppError('Keep at least one measurement, such as weight', 422, 'VALIDATION_ERROR', { fields: { weightKg: 'Keep at least one measurement' } });
  }
  const bmi = computeBmi(merged.weightKg, merged.heightCm);
  if (bmi) set.bmi = bmi;
  else unset.bmi = '';

  const saved = await withTransaction(async (session) => {
    const update = {};
    if (Object.keys(set).length) update.$set = set;
    if (Object.keys(unset).length) update.$unset = unset;
    const doc = await BodyMeasurement.findOneAndUpdate({ _id: entry._id }, update, { new: true, runValidators: true, session }).lean();
    await syncProfile(memberId, session);
    return doc;
  });
  return presentEntry(saved);
}

export async function deleteEntry({ memberId, entryId, actor }) {
  const entry = await findEditable(memberId, entryId, actor);
  await withTransaction(async (session) => {
    await BodyMeasurement.deleteOne({ _id: entry._id }, { session });
    await syncProfile(memberId, session);
  });
}
