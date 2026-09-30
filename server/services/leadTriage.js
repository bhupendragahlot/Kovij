/**
 * Automatic sorting of website enquiries with TypeSafe (System One).
 *
 * One request asks several narrow questions about the enquiry text in parallel; code then applies
 * the policy below. The model only labels; it never deletes a lead, contacts anyone, or overrides
 * a value staff have set. If TypeSafe is unavailable the lead is simply left unsorted.
 *
 * Privacy: only the message text is sent (no name, email or phone), plus the gym's plan names.
 * The message is untrusted visitor input; it can only influence these labels.
 */
import PQueue from 'p-queue';
import Lead from '../models/Lead.js';
import Plan from '../models/Plan.js';
import { getSettingsDoc } from '../models/Settings.js';
import { askSystemOne, isTypeSafeConfigured } from './typesafe/client.js';
import { planDurationToDays } from './membershipService.js';
import { logger } from '../utils/logger.js';

/** Bump when questions or policy change, so stored results can be told apart. */
export const TRIAGE_VERSION = 1;

/**
 * Every threshold in one place. Starting values are deliberately conservative; tune them
 * against real enquiries with `npm run triage:eval -- --file your-enquiries.jsonl`.
 */
export const TRIAGE_POLICY = {
  spamHide: 0.9, // hidden from the open list (still reviewable under "Likely spam")
  spamWarn: 0.5, // shown with a "Might be spam" badge
  topicMinConfidence: 0.5, // below this the topic is shown as unclear
  planMinConfidence: 0.6, // below this "Interested in" is not filled
  timeMinConfidence: 0.6,
  callbackMin: 0.7,
  readyScore: 2.5, // readiness score (0–3) for "Ready to start"
  interestedScore: 1.5,
  maxMessageChars: 2000,
  maxPlans: 20,
};

const TOPICS = {
  join: {
    what: 'Wants to become a member or start going to this gym',
    not_for: 'Only asking the price, only asking timings, or already a member',
    examples: ['I want to join your gym', 'mujhe gym join karna hai', 'membership lena hai'],
  },
  personal_training: {
    what: 'Asks about a personal trainer, one-to-one coaching, or a diet or training plan made for them',
    examples: ['Do you have personal trainers?', 'PT ke charges kya hai?'],
  },
  trial_visit: {
    what: 'Wants a trial session, or to visit and see the gym before deciding',
    examples: ['Can I come for a free trial?', 'gym dekhne aa sakte hai kya?'],
  },
  fees: {
    what: 'Mainly asks about prices, fees, plans or discounts',
    not_for: 'Messages that also say they want to start, which are "join"',
    examples: ['monthly fees kitni hai?', 'Any student discount?'],
  },
  timings: {
    what: 'Mainly asks about opening hours, batches, days open, or where the gym is',
    examples: ['What are your timings on Sunday?', 'gym kaha par hai?'],
  },
  facilities: {
    what: 'Mainly asks what the gym offers: equipment, classes such as yoga or zumba, female trainers, lockers, showers, parking, or whether it suits them',
    examples: ['Do you have zumba classes?', 'Is there parking for bikes?', 'ladies ke liye alag timing hai?'],
  },
  existing_member: {
    what: 'Is already a member and writes about their own membership, payment, receipt, trainer, equipment, cleanliness or staff',
    not_for: 'People asking to join',
    examples: ['I paid but my plan still shows expired', 'AC is not working in the cardio area'],
  },
  business: {
    what: 'A job application, partnership, sponsorship or supplier offer addressed to the gym by a real person',
    not_for: 'Bulk or automated marketing, which is spam',
    examples: ['I am a certified trainer looking for a job', 'We supply supplements to gyms in Kota'],
  },
  other: {
    what: 'None of the above, or too short or unclear to tell',
  },
};

const TIME_OPTIONS = {
  morning: { what: 'Wants to train in the morning', examples: ['morning batch', 'subah 6 baje', 'before office'] },
  evening: { what: 'Wants to train in the afternoon or evening', examples: ['evening batch', 'shaam ko', 'after college'] },
  not_mentioned: { what: 'Does not say when they want to train' },
};

function planLength(plan) {
  const days = planDurationToDays(plan);
  if (days % 365 === 0) return days === 365 ? '1 year' : `${days / 365} years`;
  if (days % 30 === 0) return days === 30 ? '1 month' : `${days / 30} months`;
  if (days % 7 === 0) return days === 7 ? '1 week' : `${days / 7} weeks`;
  return days === 1 ? '1 day' : `${days} days`;
}

/**
 * Pure: the state and questions for one enquiry. Plan options use neutral keys (plan_1…) mapped
 * back to ids in code, so ids never reach the model.
 */
export function buildTriageRequest({ message, plans = [], gymName = 'the gym' }, policy = TRIAGE_POLICY) {
  const text = String(message || '').trim().slice(0, policy.maxMessageChars);
  const planKeyToId = {};
  const planOptions = {};
  plans.slice(0, policy.maxPlans).forEach((plan, i) => {
    const key = `plan_${i + 1}`;
    planKeyToId[key] = String(plan._id);
    planOptions[key] = { what: `${plan.name}: ${planLength(plan)} for Rs ${Number(plan.price).toLocaleString('en-IN')}` };
  });

  const state = {
    form: `Contact form on the website of ${gymName}, a gym in India. Visitors often write informally, in English, Hindi or Hinglish.`,
    enquiry: { message: text },
  };

  const questions = {
    topic: {
      type: 'choice',
      instructions: 'What is the main reason the visitor wrote `enquiry.message`?',
      criteria: TOPICS,
    },
    spam: {
      type: 'noul',
      instructions: 'Is `enquiry.message` spam rather than a message from a real person writing to this gym?',
      criteria: {
        true: {
          what: 'Bulk or automated marketing, SEO, website or app services, loans, crypto, adult content, unrelated links, gibberish or test text',
          examples: ['We can rank your website #1 on Google', 'Get instant loan approval, click here', 'asdfgh test test'],
        },
        false: {
          what: 'A real person asking about the gym or writing about their membership, even if very short, informal, misspelled, or in Hindi or Hinglish',
          examples: ['fees?', 'sir timing kya hai', 'I want to join'],
        },
      },
    },
    readiness: {
      type: 'score',
      instructions: 'How close is the visitor who wrote `enquiry.message` to buying a membership or training, including renewing one they already have?',
      criteria: [
        { summary: 'Not looking to buy', signals: ['a complaint or request about an existing membership', 'job or business message', 'spam or unclear'] },
        { summary: 'Just asking', signals: ['general question about fees, timings or facilities', 'no sign of wanting to start'] },
        { summary: 'Interested', signals: ['says they want to join, train or renew', 'asks about a trial or a visit', 'compares plans'] },
        {
          summary: 'Ready to buy',
          signals: ['wants to start or renew today, tomorrow or this week', 'asks how or where to pay', 'asks what to bring on the first day'],
        },
      ],
    },
    time: {
      type: 'choice',
      instructions: 'According to `enquiry.message`, when does the visitor want to train?',
      criteria: TIME_OPTIONS,
    },
    callback: {
      type: 'noul',
      instructions: 'Does `enquiry.message` ask the gym to call, WhatsApp or message the visitor back?',
    },
  };

  if (Object.keys(planOptions).length) {
    questions.plan = {
      type: 'choice',
      instructions: "Which of the gym's plans does `enquiry.message` ask about or say the visitor wants?",
      criteria: { ...planOptions, none: { what: 'No specific plan or plan length is mentioned, or none of these plans match' } },
    };
  }

  return { state, questions, planKeyToId };
}

const round2 = (n) => Math.round(n * 100) / 100;

/** Topics that mean the person is looking to buy (used to decide whether to suggest a plan). */
const SHOPPING_TOPICS = new Set(['join', 'fees', 'trial_visit', 'personal_training']);

/** Pure: raw answers → the labels and priority stored on the lead. */
export function deriveTriage(answers, planKeyToId = {}, policy = TRIAGE_POLICY) {
  const { topic, spam, readiness, time, callback, plan } = answers;
  const spamProbability = round2(spam.noul);
  const isSpam = spamProbability >= policy.spamHide;
  const topicKey = topic.confidence >= policy.topicMinConfidence ? topic.choice : 'unclear';
  const readinessLevel = readiness.score >= policy.readyScore ? 'ready' : readiness.score >= policy.interestedScore ? 'interested' : 'browsing';

  let priority = 1;
  if (isSpam || topicKey === 'business') priority = 0;
  else if (topicKey === 'existing_member' || readinessLevel === 'ready') priority = 3;
  else if (readinessLevel === 'interested') priority = 2;

  // Suggest a plan only when the person is shopping; an amount in a complaint ("I paid 4000")
  // can match a plan's price without meaning they want it.
  const shopping = SHOPPING_TOPICS.has(topicKey) || readinessLevel !== 'browsing';

  return {
    topic: topicKey,
    topicConfidence: round2(topic.confidence),
    readiness: round2(readiness.score),
    readinessLevel,
    timePref: time && time.choice !== 'not_mentioned' && time.confidence >= policy.timeMinConfidence ? time.choice : null,
    wantsCallback: callback.noul >= policy.callbackMin,
    spamProbability,
    spam: isSpam,
    priority,
    planId:
      shopping && !isSpam && plan && plan.choice !== 'none' && plan.confidence >= policy.planMinConfidence ? planKeyToId[plan.choice] || null : null,
  };
}

/** Keep what's useful for tuning thresholds later; drop the echoed criteria text. */
function compactAnswers(answers) {
  return Object.fromEntries(
    Object.entries(answers).map(([id, a]) => {
      const { legend, ...rest } = a;
      return [id, rest];
    })
  );
}

// A burst of enquiries shouldn't fan out into a burst of API calls.
const queue = new PQueue({ concurrency: 2 });

/**
 * Sort one lead. Safe to call repeatedly; only touches `triage`, `priority`, and an empty
 * `interestPlanId`. Staff decisions (spam marked by staff, a plan they chose) are never overwritten.
 * @returns {Promise<'done'|'failed'|'skipped'>}
 */
export async function triageLead(leadId, { force = false } = {}) {
  if (!isTypeSafeConfigured()) return 'skipped';
  const lead = await Lead.findById(leadId).select('message triage interestPlanId').lean();
  if (!lead?.message?.trim()) return 'skipped';
  if (!force && lead.triage?.status === 'done' && lead.triage?.version === TRIAGE_VERSION) return 'done';

  const [plans, settings] = await Promise.all([Plan.find({ status: 'Active' }).sort({ price: 1 }).lean(), getSettingsDoc()]);
  const { state, questions, planKeyToId } = buildTriageRequest({ message: lead.message, plans, gymName: settings.gymName });

  try {
    const { answers, model } = await askSystemOne({ state, questions });
    const result = deriveTriage(answers, planKeyToId);
    const staffSpam = lead.triage?.spamSetBy === 'staff';

    const set = {
      'triage.status': 'done',
      'triage.version': TRIAGE_VERSION,
      'triage.model': model,
      'triage.at': new Date(),
      'triage.error': '',
      'triage.topic': result.topic,
      'triage.topicConfidence': result.topicConfidence,
      'triage.readiness': result.readiness,
      'triage.readinessLevel': result.readinessLevel,
      'triage.timePref': result.timePref,
      'triage.wantsCallback': result.wantsCallback,
      'triage.spamProbability': result.spamProbability,
      'triage.answers': compactAnswers(answers),
      priority: staffSpam ? (lead.triage.spam ? 0 : Math.max(result.priority, 1)) : result.priority,
    };
    if (!staffSpam) {
      set['triage.spam'] = result.spam;
      set['triage.spamSetBy'] = 'auto';
    }
    await Lead.updateOne({ _id: leadId }, { $set: set });

    // Fill "Interested in" only if it is still empty at write time (staff may have set it meanwhile).
    // (`interestPlanId: null` matches both a missing and a null field.)
    if (result.planId) {
      await Lead.updateOne(
        { _id: leadId, interestPlanId: null },
        { $set: { interestPlanId: result.planId }, $addToSet: { 'triage.filled': 'interestPlanId' } }
      );
    }
    return 'done';
  } catch (e) {
    logger.warn(`Lead triage failed for ${leadId}: ${e.code || ''} ${e.message}`);
    await Lead.updateOne({ _id: leadId }, { $set: { 'triage.status': 'failed', 'triage.error': e.code || 'ERROR', 'triage.at': new Date() } });
    return 'failed';
  }
}

/** Fire-and-forget from request handlers: never delays or fails the visitor's request. */
export function queueLeadTriage(leadId) {
  if (!isTypeSafeConfigured()) return;
  queue.add(() => triageLead(leadId)).catch((e) => logger.error(`Lead triage crashed: ${e.message}`));
}

/** Waits for queued triage jobs (used by scripts and tests). */
export const triageQueueIdle = () => queue.onIdle();
