import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideMemberLink, identityFromClaims } from '../services/memberIdentity.js';

const google = identityFromClaims({ uid: 'g1', email: 'Priya@Example.com', email_verified: true, name: 'Priya S', firebase: { sign_in_provider: 'google.com' } });
const pwUnverified = identityFromClaims({ uid: 'p1', email: 'priya@example.com', email_verified: false, firebase: { sign_in_provider: 'password' } });
const pwVerified = identityFromClaims({ uid: 'p1', email: 'priya@example.com', email_verified: true, firebase: { sign_in_provider: 'password' } });
const phone = identityFromClaims({ uid: 's1', phone_number: '+919876543210', firebase: { sign_in_provider: 'phone' } });

const deskPriya = { _id: 'm1', name: 'Priya Sharma', memberCode: 'KFZ-0001', email: 'priya@example.com' };

test('claims are normalised; only SMS sign-in yields a phone', () => {
  assert.equal(google.email, 'priya@example.com');
  assert.equal(google.phone, undefined);
  assert.equal(phone.phone, '9876543210');
  const googleWithPhone = identityFromClaims({ uid: 'x', phone_number: '+919999999999', firebase: { sign_in_provider: 'google.com' } });
  assert.equal(googleWithPhone.phone, undefined, 'an unverified phone claim is never trusted for linking');
});

test('an already-linked member is used as is', () => {
  assert.equal(decideMemberLink({ identity: google, byUid: deskPriya }).action, 'use');
});

test('email/password must verify before linking or creating', () => {
  assert.deepEqual(decideMemberLink({ identity: pwUnverified, byEmail: deskPriya }), { action: 'refuse', code: 'EMAIL_NOT_VERIFIED' });
  assert.deepEqual(decideMemberLink({ identity: pwUnverified, name: 'Priya' }), { action: 'refuse', code: 'EMAIL_NOT_VERIFIED' });
  assert.equal(decideMemberLink({ identity: pwVerified, byEmail: deskPriya }).action, 'link');
});

test('a verified email links to the desk record, but never steals one linked elsewhere', () => {
  assert.equal(decideMemberLink({ identity: google, byEmail: deskPriya }).member, deskPriya);
  assert.deepEqual(decideMemberLink({ identity: google, byEmail: { ...deskPriya, firebaseUid: 'someone-else' } }), { action: 'refuse', code: 'EMAIL_IN_USE' });
});

test('SMS sign-in links to the one unlinked member with that phone', () => {
  const res = decideMemberLink({ identity: phone, phoneMatches: [{ _id: 'm2', name: 'Rahul' }, { _id: 'm3', name: 'Old', firebaseUid: 'taken' }] });
  assert.equal(res.action, 'link');
  assert.equal(res.member._id, 'm2');
});

test('shared family phone: ask who they are, accept a valid choice, reject a forged one', () => {
  const matches = [{ _id: 'm2', name: 'Rahul', memberCode: 'KFZ-2' }, { _id: 'm4', name: 'Anita', memberCode: 'KFZ-4' }];
  const ask = decideMemberLink({ identity: phone, phoneMatches: matches });
  assert.equal(ask.action, 'choose');
  assert.deepEqual(ask.candidates.map((c) => c.id), ['m2', 'm4']);
  assert.equal(decideMemberLink({ identity: phone, phoneMatches: matches, chosenMemberId: 'm4' }).member._id, 'm4');
  assert.equal(decideMemberLink({ identity: phone, phoneMatches: matches, chosenMemberId: 'not-on-this-phone' }).action, 'choose');
  assert.deepEqual(decideMemberLink({ identity: phone, phoneMatches: matches, chosenMemberId: 'new', name: 'Kiran' }), { action: 'create', name: 'Kiran' });
});

test('new accounts need a name; Google provides one', () => {
  assert.equal(decideMemberLink({ identity: phone }).action, 'needs_name');
  assert.deepEqual(decideMemberLink({ identity: phone, name: '  Kiran Joshi ' }), { action: 'create', name: 'Kiran Joshi' });
  assert.deepEqual(decideMemberLink({ identity: google }), { action: 'create', name: 'Priya S' });
  assert.equal(decideMemberLink({ identity: phone, name: 'K' }).action, 'needs_name');
});
