/**
 * Minimal client for TypeSafe's System One endpoint (https://docs.typesafe.ai/api).
 *
 *   const answers = await askSystemOne({ state, questions });
 *
 * Server-side only: the API key never reaches the browser. Configuration is read at call
 * time because server.js loads .env after its imports are evaluated.
 *   TYPESAFE_API_KEY   required to enable any TypeSafe feature
 *   TYPESAFE_MODEL     default "jev-latest"
 *   TYPESAFE_API_URL   override for tests (the e2e suite points it at a local stub)
 */

const DEFAULT_URL = 'https://api.typesafe.ai/v1/systemone';
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504, 529]);

export class TypeSafeError extends Error {
  constructor(message, { status, code = 'TYPESAFE_ERROR', retryable = false } = {}) {
    super(message);
    this.name = 'TypeSafeError';
    this.status = status;
    this.code = code;
    this.retryable = retryable;
  }
}

export const isTypeSafeConfigured = () => Boolean(process.env.TYPESAFE_API_KEY);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function backoffMs(attempt, retryAfterHeader) {
  const retryAfter = Number(retryAfterHeader);
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter * 1000, 10_000);
  return Math.min(400 * 2 ** attempt, 4000) + Math.floor(Math.random() * 200);
}

/** Every requested question must come back with the requested type; anything else is unusable. */
function validateAnswers(questions, body) {
  const answers = body?.answers;
  if (!answers || typeof answers !== 'object') throw new TypeSafeError('Response has no answers', { code: 'TYPESAFE_MALFORMED' });
  for (const [id, q] of Object.entries(questions)) {
    const a = answers[id];
    const ok =
      a?.type === q.type &&
      (q.type === 'noul' ? typeof a.noul === 'number' : q.type === 'choice' ? typeof a.choice === 'string' : typeof a.score === 'number');
    if (!ok) throw new TypeSafeError(`Answer for "${id}" is missing or has the wrong type`, { code: 'TYPESAFE_MALFORMED' });
  }
  return answers;
}

/**
 * Ask several questions about one state in a single request (they are evaluated in parallel).
 * @returns {Promise<{ answers: Record<string, object>, model: string, usage?: object }>}
 */
export async function askSystemOne({ state, questions, model, timeoutMs = 8000, retries = 2, fetchImpl = fetch }) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) throw new TypeSafeError('TYPESAFE_API_KEY is not set', { code: 'TYPESAFE_NOT_CONFIGURED' });

  const url = process.env.TYPESAFE_API_URL || DEFAULT_URL;
  const payload = JSON.stringify({ model: model || process.env.TYPESAFE_MODEL || 'jev-latest', state, questions });

  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetchImpl(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: payload,
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const timedOut = e?.name === 'TimeoutError' || e?.name === 'AbortError';
      const err = new TypeSafeError(timedOut ? `No response within ${timeoutMs} ms` : `Network error: ${e?.message}`, {
        code: timedOut ? 'TYPESAFE_TIMEOUT' : 'TYPESAFE_NETWORK',
        retryable: true,
      });
      if (attempt >= retries) throw err;
      await sleep(backoffMs(attempt));
      continue;
    }

    if (res.ok) {
      const body = await res.json().catch(() => null);
      return { answers: validateAnswers(questions, body), model: body.model, usage: body.usage };
    }

    const retryable = RETRYABLE_STATUS.has(res.status);
    if (retryable && attempt < retries) {
      await sleep(backoffMs(attempt, res.headers.get('retry-after')));
      continue;
    }
    const detail = await res.text().catch(() => '');
    throw new TypeSafeError(`TypeSafe returned ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ''}`, {
      status: res.status,
      code: res.status === 401 || res.status === 403 ? 'TYPESAFE_AUTH' : res.status === 429 ? 'TYPESAFE_RATE_LIMIT' : 'TYPESAFE_HTTP',
      retryable,
    });
  }
}
