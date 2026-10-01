import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RESOLVED_REOPEN_DAYS, isExpiredResolution, statusAfterReply, ticketView } from '../services/supportService.js';

const NOW = new Date('2026-10-01T10:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * 86_400_000);

test('a member reply reopens; a desk reply waits for the member unless staff resolve it', () => {
  assert.equal(statusAfterReply('waiting_member', 'member'), 'open');
  assert.equal(statusAfterReply('resolved', 'member'), 'open');
  assert.equal(statusAfterReply('open', 'staff'), 'waiting_member');
  assert.equal(statusAfterReply('open', 'staff', 'resolved'), 'resolved');
  assert.throws(() => statusAfterReply('closed', 'member'), /closed/);
  assert.throws(() => statusAfterReply('closed', 'staff'), /closed/);
});

test('resolved requests can be reopened for a week, then count as closed', () => {
  assert.equal(RESOLVED_REOPEN_DAYS, 7);
  assert.equal(isExpiredResolution({ status: 'resolved', resolvedAt: daysAgo(3) }, NOW), false);
  assert.equal(isExpiredResolution({ status: 'resolved', resolvedAt: daysAgo(8) }, NOW), true);
  assert.equal(isExpiredResolution({ status: 'open', resolvedAt: daysAgo(30) }, NOW), false);
});

const ticket = {
  _id: '66f0c0ffee0c0ffee0c0ffee',
  number: 7,
  category: 'payment',
  subject: 'Paid by UPI but still shows due',
  status: 'waiting_member',
  unreadForMember: true,
  unreadForStaff: false,
  assignedTo: { _id: '66f0c0ffee0c0ffee0c0ff00', name: 'Priya Sharma' },
  memberId: { _id: '66f0c0ffee0c0ffee0c0ff11', name: 'Rahul Verma', phone: '9876543210', memberCode: 'KFZ-0012' },
  messages: [
    { _id: 'a1', by: 'member', text: 'I paid ₹1,500 yesterday', at: daysAgo(1) },
    { _id: 'a2', by: 'staff', staffId: 'x', staffName: 'Priya Sharma', text: 'Can you share the UTR?', at: NOW },
  ],
};

test('members see first names only, never who is assigned', () => {
  const v = ticketView(ticket, 'member');
  assert.equal(v.reference, '#0007');
  assert.equal(v.unread, true);
  assert.equal(v.canReply, true);
  assert.deepEqual(v.messages.map((m) => m.author), ['You', 'Priya']);
  assert.equal('assignedTo' in v, false);
  assert.equal('member' in v, false);
  assert.equal(JSON.stringify(v).includes('staffId'), false);
  assert.equal(ticketView({ ...ticket, status: 'closed' }, 'member').canReply, false);
});

test('staff see the member, the assignee and full names', () => {
  const v = ticketView(ticket, 'staff');
  assert.equal(v.member.name, 'Rahul Verma');
  assert.equal(v.assignedTo.name, 'Priya Sharma');
  assert.deepEqual(v.messages.map((m) => m.author), ['Rahul Verma', 'Priya Sharma']);
  assert.equal(v.preview, 'Can you share the UTR?');
  assert.equal(v.unread, false);
});
