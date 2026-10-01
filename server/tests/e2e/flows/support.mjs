// Member support: requests from the app, replies from the desk, statuses, permissions.
import { adminToken, call, check, createMember, finish, key, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);
const { member, token: M } = await createMember(T, { name: uniq('Support Member ') });
const { token: OTHER } = await createMember(T);

// Member opens a request.
const bad = await call('POST', '/member/support', { token: M, body: { subject: 'x', message: '' } });
check('a request needs a subject and a message', bad.status === 422 && bad.body.details?.fields?.subject && bad.body.details?.fields?.message, bad.body);
const idem = key();
const created = await call('POST', '/member/support', { token: M, idem, body: { category: 'payment', subject: 'Paid by UPI but still shows due', message: 'I paid ₹1,500 yesterday evening.' } });
check('member opens a support request', created.status === 201 && created.body.ticket.status === 'open' && /^#\d{4}$/.test(created.body.ticket.reference), created.body);
const id = created.body.ticket.id;
const again = await call('POST', '/member/support', { token: M, idem, body: { category: 'payment', subject: 'Paid by UPI but still shows due', message: 'I paid ₹1,500 yesterday evening.' } });
check('a double tap creates it once', again.body.ticket?.id === id);
check('another member can’t see it (404)', (await call('GET', `/member/support/${id}`, { token: OTHER })).status === 404);
check('another member can’t reply to it (404)', (await call('POST', `/member/support/${id}/messages`, { token: OTHER, body: { text: 'hello there' } })).status === 404);
const mine = await call('GET', '/member/support', { token: M });
check('member lists their requests', mine.body.items.length === 1 && mine.body.items[0].preview.startsWith('I paid'));

// The desk sees it in the inbox.
const inbox = await call('GET', '/admin/support', { token: desk.token });
const row = inbox.body.items?.find((t) => t.id === id);
check('front desk sees it in the inbox, unread, with the member', row?.unread === true && row.member?.name === member.name && inbox.body.counts.unread >= 1, inbox.body.counts);
const search = await call('GET', `/admin/support?q=${encodeURIComponent(member.name)}&status=all`, { token: desk.token });
check('the inbox can be searched by member name', search.body.items.some((t) => t.id === id));
const byNumber = await call('GET', `/admin/support?q=${encodeURIComponent(created.body.ticket.reference)}&status=all`, { token: desk.token });
check('…or by request number', byNumber.body.items.some((t) => t.id === id));
const opened = await call('GET', `/admin/support/${id}`, { token: desk.token });
check('opening it shows the conversation and the member’s plan state', opened.body.ticket.messages.length === 1 && typeof opened.body.ticket.member.state === 'string');
check('opening it marks it read for the desk', (await call('GET', '/admin/support', { token: desk.token })).body.items.find((t) => t.id === id)?.unread === false);

// Desk replies; the member is notified.
const reply = await call('POST', `/admin/support/${id}/messages`, { token: desk.token, idem: key(), body: { text: 'Thanks! Can you share the UPI reference (UTR) from your payment app?' } });
check('desk replies; it now waits for the member', reply.status === 200 && reply.body.ticket.status === 'waiting_member' && reply.body.ticket.assignedTo?.id === desk.user.id, reply.body);
const notes = await call('GET', '/member/notifications', { token: M });
check('the member gets an in-app notification linking to the request', notes.body.items?.some((n) => n.kind === 'support' && n.link === `/member/support/${id}`), notes.body.items?.map((n) => n.kind));
const seen = await call('GET', `/member/support/${id}`, { token: M });
check('member sees the reply from a first name', seen.body.ticket.messages[1].author === 'Test' && seen.body.ticket.messages[1].by === 'staff', seen.body.ticket.messages);
check('member view never shows who is assigned', !('assignedTo' in seen.body.ticket));

const back = await call('POST', `/member/support/${id}/messages`, { token: M, body: { text: 'UTR 4321 8765 1122' } });
check('member reply reopens it for the desk', back.body.ticket.status === 'open');
check('…and it is unread again at the desk', (await call('GET', '/admin/support', { token: desk.token })).body.items.find((t) => t.id === id)?.unread === true);

const done = await call('POST', `/admin/support/${id}/messages`, { token: desk.token, body: { text: 'Found it and marked your dues paid. Sorry for the trouble!', status: 'resolved' } });
check('desk can reply and resolve in one step', done.body.ticket.status === 'resolved' && Boolean(done.body.ticket.resolvedAt));
const reopened = await call('POST', `/member/support/${id}/messages`, { token: M, body: { text: 'Still shows due in the app' } });
check('a resolved request reopens when the member writes again', reopened.body.ticket.status === 'open');

const closed = await call('PATCH', `/admin/support/${id}`, { token: T, body: { status: 'closed' } });
check('staff can close it', closed.body.ticket.status === 'closed');
const late = await call('POST', `/member/support/${id}/messages`, { token: M, body: { text: 'one more thing' } });
check('a closed request can’t be reopened (409)', late.status === 409 && late.body.code === 'TICKET_CLOSED');
check('the member is told they can’t reply', (await call('GET', `/member/support/${id}`, { token: M })).body.ticket.canReply === false);

const assign = await call('PATCH', `/admin/support/${id}`, { token: T, body: { assignedTo: desk.user.id, category: 'app' } });
check('owner can reassign and recategorise', assign.body.ticket.assignedTo?.id === desk.user.id && assign.body.ticket.category === 'app');
check('assigning to a made-up account is refused', (await call('PATCH', `/admin/support/${id}`, { token: T, body: { assignedTo: '66f0c0ffee0c0ffee0c0ffee' } })).status === 422);

// Limits and permissions.
for (let i = 0; i < 5; i += 1) await call('POST', '/member/support', { token: M, body: { subject: `Question ${i}`, message: 'Just checking something here' } });
const sixth = await call('POST', '/member/support', { token: M, body: { subject: 'One too many', message: 'Another question for you' } });
check('at most 5 open requests per member', sixth.status === 409 && sixth.body.code === 'TOO_MANY_OPEN');
check('trainer can’t open the inbox (403)', (await call('GET', '/admin/support', { token: trainer.token })).status === 403);
check('a member token can’t open the inbox', [401, 403].includes((await call('GET', '/admin/support', { token: M })).status));
const dash = await call('GET', '/admin/dashboard', { token: desk.token });
check('the desk dashboard counts unread member messages', typeof dash.body.support?.unread === 'number' && dash.body.support.unread >= 5, dash.body.support);
check('trainer dashboard has no support count', (await call('GET', '/admin/dashboard', { token: trainer.token })).body.support === undefined);

finish();
