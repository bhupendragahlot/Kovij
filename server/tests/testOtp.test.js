import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isTestOtpOn, matchesTestOtp, testOtpCode } from '../services/testOtp.js';

test('test mode is on only with a 4-8 digit code outside production', () => {
  assert.equal(testOtpCode({ DEFAULT_OTP: '112233' }), '112233');
  assert.equal(testOtpCode({ DEFULT_OTP: '112233' }), '112233', 'the misspelt name works too');
  assert.equal(testOtpCode({ DEFAULT_OTP: '112233', NODE_ENV: 'development' }), '112233');
  assert.equal(testOtpCode({ DEFAULT_OTP: '112233', NODE_ENV: 'production' }), null, 'never on the live site');
  assert.equal(testOtpCode({ DEFULT_OTP: '112233', NODE_ENV: 'production' }), null);
  assert.equal(testOtpCode({}), null);
  assert.equal(testOtpCode({ DEFAULT_OTP: '' }), null);
  assert.equal(testOtpCode({ DEFAULT_OTP: '12' }), null, 'too short');
  assert.equal(testOtpCode({ DEFAULT_OTP: '12ab56' }), null, 'digits only');
  assert.equal(isTestOtpOn({ DEFAULT_OTP: ' 112233 ' }), true);
});

test('only the exact code matches', () => {
  const env = { DEFAULT_OTP: '112233' };
  assert.equal(matchesTestOtp('112233', env), true);
  assert.equal(matchesTestOtp(' 112233 ', env), true);
  assert.equal(matchesTestOtp('112234', env), false);
  assert.equal(matchesTestOtp('1122330', env), false);
  assert.equal(matchesTestOtp('', env), false);
  assert.equal(matchesTestOtp(undefined, env), false);
  assert.equal(matchesTestOtp('112233', { DEFAULT_OTP: '112233', NODE_ENV: 'production' }), false);
});
