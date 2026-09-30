import Lead from '../models/Lead.js';
import Member from '../models/Member.js';
import { getSettingsDoc } from '../models/Settings.js';
import { registerDeskMember } from '../services/salesService.js';
import { findPossibleDuplicates } from '../services/memberService.js';
import { triageLead } from '../services/leadTriage.js';
import { isTypeSafeConfigured } from '../services/typesafe/client.js';
import { withTransaction } from '../utils/db.js';
import { escapeRegex, normalizePhone } from '../utils/strings.js';
import { endOfGymDay, startOfGymDay } from '../utils/time.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../middleware/errorHandler.js';

const OPEN = ['new', 'contacted', 'trial'];

const NOT_SPAM = { 'triage.spam': { $ne: true } };

/** GET /api/admin/leads — likely spam is hidden unless `spam=only`. */
export const listLeads = asyncHandler(async (req, res) => {
  const { status, due, q, spam, page, limit } = req.validated.query;
  const filter = spam === 'only' ? { 'triage.spam': true } : { ...NOT_SPAM };
  if (status === 'open') filter.status = { $in: OPEN };
  else if (status !== 'all') filter.status = status;
  if (due === 'today') filter.nextFollowUpAt = { $lte: endOfGymDay() };
  if (due === 'overdue') filter.nextFollowUpAt = { $lt: startOfGymDay() };
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    const digits = normalizePhone(q);
    filter.$or = [{ name: rx }, { email: rx }, ...(digits.length >= 3 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])];
  }

  // Within the same follow-up time, higher priority (ready to start, member issue) comes first.
  const isOpenList = status === 'open' || OPEN.includes(status);
  const sort = isOpenList ? { nextFollowUpAt: 1, priority: -1, createdAt: -1 } : { updatedAt: -1 };
  const [leads, total, counts, spamCount] = await Promise.all([
    Lead.find(filter)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(limit)
      .select('-triage.answers')
      .populate('interestPlanId', 'name price')
      .populate('assignedTo', 'name username')
      .lean(),
    Lead.countDocuments(filter),
    Lead.aggregate([{ $match: NOT_SPAM }, { $group: { _id: '$status', n: { $sum: 1 } } }]),
    Lead.countDocuments({ 'triage.spam': true, status: { $in: OPEN } }),
  ]);
  const byStatus = Object.fromEntries(counts.map((c) => [c._id, c.n]));
  byStatus.open = OPEN.reduce((sum, s) => sum + (byStatus[s] || 0), 0);
  byStatus.spam = spamCount;
  res.json({ success: true, leads, total, page, limit, counts: byStatus, triageEnabled: isTypeSafeConfigured() });
});

/** POST /api/admin/leads */
export const createLead = asyncHandler(async (req, res) => {
  const { note, ...data } = req.validated.body;
  const memberMatches = await findPossibleDuplicates({ phone: data.phone, email: data.email });
  const lead = await Lead.create({
    ...data,
    nextFollowUpAt: data.nextFollowUpAt || endOfGymDay(),
    createdBy: req.staffUser.id,
    assignedTo: req.staffUser.id,
    notes: note ? [{ text: note, by: req.staffUser.id, byName: req.staffUser.name }] : [],
  });
  res.status(201).json({
    success: true,
    lead,
    // Not an error: the desk may be talking to a lapsed member. The UI offers "Open member" instead.
    memberMatches: memberMatches.map((m) => ({ id: m._id, name: m.name, phone: m.phone, memberCode: m.memberCode })),
  });
});

/** PATCH /api/admin/leads/:id — `spam: true|false` is a staff decision that automatic sorting then respects. */
export const updateLead = asyncHandler(async (req, res) => {
  const { spam, ...fields } = req.validated.body;
  const set = { ...fields };
  if (spam !== undefined) {
    set['triage.spam'] = spam;
    set['triage.spamSetBy'] = 'staff';
    if (spam) set.priority = 0;
  }
  // Choosing a plan by hand means it is no longer a suggestion.
  const pull = 'interestPlanId' in fields ? { $pull: { 'triage.filled': 'interestPlanId' } } : {};
  const lead = await Lead.findByIdAndUpdate(req.params.id, { $set: set, ...pull }, { new: true, runValidators: true })
    .select('-triage.answers')
    .populate('interestPlanId', 'name price')
    .lean();
  if (!lead) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  res.json({ success: true, lead });
});

/** POST /api/admin/leads/:id/triage — sort (or re-sort) one enquiry now. */
export const retriageLead = asyncHandler(async (req, res) => {
  if (!isTypeSafeConfigured()) {
    throw new AppError('Automatic sorting is off. Add TYPESAFE_API_KEY to the server settings to turn it on.', 409, 'TRIAGE_OFF');
  }
  const exists = await Lead.exists({ _id: req.params.id });
  if (!exists) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  const outcome = await triageLead(req.params.id, { force: true });
  if (outcome === 'skipped') throw new AppError('This lead has no message to sort', 422, 'NO_MESSAGE');
  if (outcome === 'failed') throw new AppError("Couldn't sort this enquiry right now. Try again in a minute.", 503, 'TRIAGE_FAILED');
  const lead = await Lead.findById(req.params.id).select('-triage.answers').populate('interestPlanId', 'name price').lean();
  res.json({ success: true, lead });
});

/** POST /api/admin/leads/:id/notes */
export const addLeadNote = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  lead.notes.push({ text: req.validated.body.text, by: req.staffUser.id, byName: req.staffUser.name });
  if (lead.status === 'new') lead.status = 'contacted';
  await lead.save();
  res.status(201).json({ success: true, lead });
});

/**
 * POST /api/admin/leads/:id/convert — turn a lead into a member (no plan yet).
 * If a member with the same phone/email exists, link to them instead of duplicating.
 */
export const convertLead = asyncHandler(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw new AppError('Lead not found', 404, 'NOT_FOUND');
  if (lead.convertedMemberId) {
    return res.json({ success: true, memberId: lead.convertedMemberId, alreadyConverted: true });
  }
  if (!lead.phone) throw new AppError('Add a phone number before converting this lead', 422, 'PHONE_REQUIRED');

  const [existing] = await findPossibleDuplicates({ phone: lead.phone, email: lead.email });
  let memberId = existing?._id;
  if (!memberId) {
    const settings = await getSettingsDoc();
    const { member } = await withTransaction((session) =>
      registerDeskMember(
        {
          details: { name: lead.name, phone: lead.phone, email: lead.email },
          force: true,
          staff: { id: req.staffUser.id, role: req.staffUser.role },
          settings,
          source: 'lead',
        },
        session
      )
    );
    memberId = member._id;
  }

  lead.status = 'won';
  lead.convertedMemberId = memberId;
  lead.nextFollowUpAt = undefined;
  await lead.save();
  const member = await Member.findById(memberId).select('name memberCode').lean();
  res.status(201).json({ success: true, memberId, member, linkedExisting: Boolean(existing) });
});
