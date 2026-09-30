import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildTriageRequest, deriveTriage, TRIAGE_POLICY } from '../services/leadTriage.js';
import { askSystemOne, TypeSafeError } from '../services/typesafe/client.js';

const plans = [
  { _id: 'id-monthly', name: 'Monthly', price: 1500, duration: 'month' },
  { _id: 'id-annual', name: 'Annual', price: 12000, duration: 'year' },
];

/** Answers shaped like the API's, with overridable parts. */
function answers(over = {}) {
  return {
    topic: { type: 'choice', choice: 'join', confidence: 0.9 },
    spam: { type: 'noul', noul: 0.02 },
    readiness: { type: 'score', score: 2, confidence: 0.9 },
    time: { type: 'choice', choice: 'not_mentioned', confidence: 0.9 },
    callback: { type: 'noul', noul: 0.1 },
    plan: { type: 'choice', choice: 'none', confidence: 0.9 },
    ...over,
  };
}

test('request sends only the message text, never contact details, and maps plans to neutral keys', () => {
  const { state, questions, planKeyToId } = buildTriageRequest({ message: '  I want to join  ', plans, gymName: 'Kovij' });
  assert.deepEqual(Object.keys(state), ['form', 'enquiry']);
  assert.deepEqual(state.enquiry, { message: 'I want to join' });
  assert.deepEqual(planKeyToId, { plan_1: 'id-monthly', plan_2: 'id-annual' });
  assert.match(questions.plan.criteria.plan_2.what, /Annual: 1 year for Rs 12,000/);
  assert.ok(questions.plan.criteria.none, 'plan question offers a no-match option');
  assert.ok(!JSON.stringify(questions).includes('id-monthly'), 'database ids never reach the model');
});

test('no plan question when the gym has no active plans; long messages are capped', () => {
  const { questions, state } = buildTriageRequest({ message: 'x'.repeat(5000) });
  assert.equal(questions.plan, undefined);
  assert.equal(state.enquiry.message.length, TRIAGE_POLICY.maxMessageChars);
});

test('spam is hidden only at high probability; business and spam get lowest priority', () => {
  assert.equal(deriveTriage(answers({ spam: { type: 'noul', noul: 0.89 } })).spam, false);
  const spam = deriveTriage(answers({ spam: { type: 'noul', noul: 0.95 } }));
  assert.equal(spam.spam, true);
  assert.equal(spam.priority, 0);
  assert.equal(deriveTriage(answers({ topic: { type: 'choice', choice: 'business', confidence: 0.9 } })).priority, 0);
});

test('ready-to-buy and member issues rank first; low-confidence topics show as unclear', () => {
  assert.equal(deriveTriage(answers({ readiness: { type: 'score', score: 2.9 } })).priority, 3);
  assert.equal(deriveTriage(answers({ topic: { type: 'choice', choice: 'existing_member', confidence: 0.9 }, readiness: { type: 'score', score: 0 } })).priority, 3);
  assert.equal(deriveTriage(answers({ readiness: { type: 'score', score: 1.6 } })).readinessLevel, 'interested');
  assert.equal(deriveTriage(answers({ topic: { type: 'choice', choice: 'fees', confidence: 0.4 } })).topic, 'unclear');
});

test('a plan is suggested only when confident, the person is shopping, and it is not spam', () => {
  const keys = { plan_2: 'id-annual' };
  const annual = { type: 'choice', choice: 'plan_2', confidence: 0.8 };
  assert.equal(deriveTriage(answers({ plan: annual }), keys).planId, 'id-annual');
  assert.equal(deriveTriage(answers({ plan: { ...annual, confidence: 0.5 } }), keys).planId, null);
  // "I paid 4000 but…" — a member complaint that happens to match a price.
  const complaint = answers({ plan: annual, topic: { type: 'choice', choice: 'existing_member', confidence: 1 }, readiness: { type: 'score', score: 0 } });
  assert.equal(deriveTriage(complaint, keys).planId, null);
  assert.equal(deriveTriage(answers({ plan: annual, spam: { type: 'noul', noul: 0.99 } }), keys).planId, null);
});

// ── client

const okBody = { model: 'jev-1.13.0', answers: { spam: { type: 'noul', noul: 0.1 } } };
const questions = { spam: { type: 'noul', instructions: 'Is this spam?' } };
const reply = (status, body, headers = {}) => new Response(typeof body === 'string' ? body : JSON.stringify(body), { status, headers });

async function withKey(fn) {
  const saved = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = 'test-key';
  try {
    return await fn();
  } finally {
    if (saved === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = saved;
  }
}

test('client retries overload (529) and then succeeds; sends the bearer key', () =>
  withKey(async () => {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push(init.headers.Authorization);
      return calls.length === 1 ? reply(529, 'overloaded', { 'retry-after': '0.01' }) : reply(200, okBody);
    };
    const res = await askSystemOne({ state: 'x', questions, fetchImpl });
    assert.equal(res.answers.spam.noul, 0.1);
    assert.deepEqual(calls, ['Bearer test-key', 'Bearer test-key']);
  }));

test('client does not retry a bad request, and reports auth failures distinctly', () =>
  withKey(async () => {
    let n = 0;
    await assert.rejects(
      askSystemOne({ state: 'x', questions, fetchImpl: async () => (n++, reply(400, 'bad')) }),
      (e) => e instanceof TypeSafeError && e.status === 400 && !e.retryable
    );
    assert.equal(n, 1);
    await assert.rejects(askSystemOne({ state: 'x', questions, fetchImpl: async () => reply(401, 'no') }), { code: 'TYPESAFE_AUTH' });
  }));

test('client rejects answers of the wrong shape and times out slow responses', () =>
  withKey(async () => {
    const wrong = { answers: { spam: { type: 'choice', choice: 'yes' } } };
    await assert.rejects(askSystemOne({ state: 'x', questions, fetchImpl: async () => reply(200, wrong) }), { code: 'TYPESAFE_MALFORMED' });
    const hang = (url, init) => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason)));
    await assert.rejects(askSystemOne({ state: 'x', questions, fetchImpl: hang, timeoutMs: 30, retries: 0 }), { code: 'TYPESAFE_TIMEOUT' });
  }));

test('client refuses to run without a key', async () => {
  const saved = process.env.TYPESAFE_API_KEY;
  delete process.env.TYPESAFE_API_KEY;
  try {
    await assert.rejects(askSystemOne({ state: 'x', questions }), { code: 'TYPESAFE_NOT_CONFIGURED' });
  } finally {
    if (saved !== undefined) process.env.TYPESAFE_API_KEY = saved;
  }
});
