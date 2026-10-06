/**
 * Member app passwords (services/memberPasswordService.js): the date-of-birth default, reading a
 * login, password rules, and the lockout. No database needed.
 */
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import {
  checkMemberPassword,
  defaultMemberPassword,
  memberLockout,
  memberPasswordProblem,
  parseLogin,
  recordMemberFailure,
  resetMemberLockouts,
} from '../services/memberPasswordService.js';

beforeEach(() => resetMemberLockouts());

test('the first password is the date of birth as DDMMYYYY, on the gym calendar', () => {
  assert.equal(defaultMemberPassword(new Date('1995-08-15')), '15081995'); // a form date (UTC midnight)
  assert.equal(defaultMemberPassword(new Date('1995-08-14T18:30:00Z')), '15081995'); // the same day saved as IST midnight
  assert.equal(defaultMemberPassword(new Date('2001-01-05')), '05012001');
});

test('a login can be a mobile number, an email or a member ID', () => {
  assert.deepEqual(parseLogin('98765 43210'), { by: 'phone', value: '9876543210' });
  assert.deepEqual(parseLogin('+91 98765-43210'), { by: 'phone', value: '9876543210' });
  assert.deepEqual(parseLogin('  Asha@Example.COM '), { by: 'email', value: 'asha@example.com' });
  assert.deepEqual(parseLogin('kfz-0042'), { by: 'memberCode', value: 'KFZ-0042' });
  assert.deepEqual(parseLogin('KFZ0042'), { by: 'memberCode', value: 'KFZ-0042' });
  assert.equal(parseLogin('12345'), null);
  assert.equal(parseLogin(''), null);
});

test('the default password is also accepted typed as a date; a chosen one only exactly', async () => {
  const def = { passwordHash: await bcrypt.hash('15081995', 4), passwordIsDefault: true };
  assert.equal(await checkMemberPassword(def, '15081995'), true);
  assert.equal(await checkMemberPassword(def, '15-08-1995'), true);
  assert.equal(await checkMemberPassword(def, '15/08/1995'), true);
  assert.equal(await checkMemberPassword(def, '16081995'), false);
  const chosen = { passwordHash: await bcrypt.hash('blue-river-77', 4), passwordIsDefault: false };
  assert.equal(await checkMemberPassword(chosen, 'blue-river-77'), true);
  assert.equal(await checkMemberPassword(chosen, 'bluerivr77'), false);
  assert.equal(await checkMemberPassword({}, '15081995'), false, 'no password set');
  assert.equal(await checkMemberPassword(def, ''), false);
});

test('a new password can’t be short, the date of birth, the mobile number or the email', () => {
  const m = { dob: new Date('1995-08-15'), phone: '9876543210', email: 'asha@example.com' };
  assert.match(memberPasswordProblem('short', m), /at least 8/);
  assert.match(memberPasswordProblem('15081995', m), /date of birth/);
  assert.match(memberPasswordProblem('15-08-1995', m), /date of birth/);
  assert.match(memberPasswordProblem('9876543210', m), /mobile number/);
  assert.match(memberPasswordProblem('asha@example.com', m), /email/);
  assert.match(memberPasswordProblem('12345678', m), /too easy/);
  assert.equal(memberPasswordProblem('strong-pass-2026', m), null);
});

test('5 wrong passwords in 15 minutes lock that login for 15 minutes', () => {
  const t0 = new Date('2026-10-06T10:00:00Z');
  for (let i = 0; i < 4; i += 1) recordMemberFailure('phone:9876543210', new Date(t0.getTime() + i * 1000));
  assert.equal(memberLockout('phone:9876543210', t0).locked, false);
  recordMemberFailure('phone:9876543210', new Date(t0.getTime() + 5000));
  const locked = memberLockout('phone:9876543210', new Date(t0.getTime() + 6000));
  assert.equal(locked.locked, true);
  assert.equal(locked.retryAfterMinutes, 15);
  assert.equal(memberLockout('phone:9999999999', t0).locked, false, 'other logins unaffected');
  assert.equal(memberLockout('phone:9876543210', new Date(t0.getTime() + 16 * 60_000)).locked, false, 'unlocks after the window');
});
