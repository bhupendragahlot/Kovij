import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canonicalPhone, escapeHtml, escapeRegex, stableStringify } from '../utils/strings.js';
import { campaignBodyEmail } from '../services/emailTemplates/index.js';
import { planDurationToDays, parsePlanPrice, prorationCredit } from '../services/membershipService.js';

test('canonicalPhone stores one form per number', () => {
  for (const input of ['9876543210', '98765 43210', '+91 98765-43210', '919876543210', '09876543210']) {
    assert.equal(canonicalPhone(input), '9876543210', input);
  }
  assert.equal(canonicalPhone('+44 20 7946 0958'), '+442079460958');
  assert.equal(canonicalPhone('   '), undefined);
});

test('stableStringify ignores key order and undefined values', () => {
  assert.equal(stableStringify({ b: 1, a: { d: 2, c: [1, { y: 1, x: 2 }] } }), stableStringify({ a: { c: [1, { x: 2, y: 1 }], d: 2 }, b: 1, z: undefined }));
  assert.notEqual(stableStringify({ amount: 100 }), stableStringify({ amount: 1000 }));
});

test('escapeHtml neutralises markup', () => {
  assert.equal(escapeHtml('<img src=x onerror="alert(1)">'), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
  assert.equal(escapeHtml(null), '');
});

test('escapeRegex makes user input literal', () => {
  assert.ok(new RegExp(escapeRegex('a+(b)')).test('xa+(b)y'));
  assert.doesNotThrow(() => new RegExp(escapeRegex('(((')));
});

test('campaign placeholders are filled and escaped in HTML only', () => {
  const { subject, html } = campaignBodyEmail({ subject: '{{firstName}}, 20% off & more', bodyHtml: '<p>Hi {{firstName}} at {{gym}}</p>', name: 'Ravi <b>K</b>', gymName: 'Kovij' });
  assert.equal(subject, 'Ravi, 20% off & more');
  assert.equal(html, '<p>Hi Ravi at Kovij</p>');
  const hostile = campaignBodyEmail({ subject: 's', bodyHtml: '{{name}}', name: '<script>x</script>' });
  assert.equal(hostile.html, '&lt;script&gt;x&lt;/script&gt;');
});

test('plan helpers', () => {
  assert.equal(planDurationToDays({ duration: 'quarter' }), 90);
  assert.equal(planDurationToDays({ duration: 'month', durationInDays: 45 }), 45);
  assert.equal(parsePlanPrice({ price: '₹1,499' }), 1499);
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-01-31T00:00:00Z');
  assert.equal(prorationCredit(new Date('2026-01-16T00:00:00Z'), start, end, 3000), 1500);
});
