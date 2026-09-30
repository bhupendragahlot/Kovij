/**
 * Local stand-in for the TypeSafe API used by the e2e suite, so tests never need a real key.
 * Answers every question with the requested type, steered by keywords in the enquiry, and
 * rejects requests that break the documented contract. GET /_inspect reports what it saw.
 */
import http from 'node:http';

const PRIVATE = [/@/, /\d{10}/]; // an email or a 10-digit phone in the state is a privacy leak

function answerFor(id, q, message) {
  const m = message.toLowerCase();
  if (q.type === 'noul') {
    if (id === 'spam') return { type: 'noul', noul: m.includes('rank your website') ? 0.98 : 0.03 };
    if (id === 'callback') return { type: 'noul', noul: m.includes('call me') ? 0.92 : 0.05 };
    return { type: 'noul', noul: 0.1 };
  }
  if (q.type === 'score') {
    const score = m.includes('join') ? 2.9 : 1;
    return { type: 'score', score, confidence: 0.9, probabilities: {}, legend: {} };
  }
  const keys = Object.keys(q.criteria);
  let choice = keys.includes('other') ? 'other' : keys.includes('none') ? 'none' : keys.includes('not_mentioned') ? 'not_mentioned' : keys[0];
  if (id === 'topic' && m.includes('join')) choice = 'join';
  if (id === 'time' && m.includes('evening')) choice = 'evening';
  if (id === 'plan' && m.includes('monthly')) choice = keys.find((k) => /Monthly/.test(q.criteria[k]?.what || '')) || choice;
  return { type: 'choice', choice, confidence: 0.9, probabilities: { [choice]: 0.95 } };
}

export async function startTypeSafeStub() {
  const seen = { requests: 0, leaks: 0, rejected: 0 };
  const server = http.createServer((req, res) => {
    if (req.method === 'GET' && req.url === '/_inspect') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(seen));
    }
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      seen.requests += 1;
      const send = (status, body) => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      };
      let body;
      try {
        body = JSON.parse(raw);
      } catch {
        seen.rejected += 1;
        return send(400, { error: 'invalid json' });
      }
      const valid =
        req.headers.authorization === 'Bearer e2e-typesafe-key' &&
        typeof body.model === 'string' &&
        body.state && typeof body.state.enquiry?.message === 'string' &&
        Object.values(body.questions || {}).every((q) => ['noul', 'choice', 'score'].includes(q.type) && q.instructions);
      if (!valid) {
        seen.rejected += 1;
        return send(400, { error: 'request does not match the API contract' });
      }
      if (PRIVATE.some((rx) => rx.test(JSON.stringify(body.state)))) seen.leaks += 1;
      const message = body.state.enquiry.message;
      if (message.includes('TYPESAFE_DOWN')) return send(500, { error: 'simulated outage' });
      const answers = Object.fromEntries(Object.entries(body.questions).map(([id, q]) => [id, answerFor(id, q, message)]));
      send(200, { model: 'stub-1', answers, usage: { input_tokens: 1, output_tokens: 1 } });
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return { url: `http://127.0.0.1:${port}`, close: () => new Promise((r) => server.close(r)) };
}
