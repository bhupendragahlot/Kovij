// Uploaded files live in the database, not on the server's disk: they must survive the host
// wiping the disk (Render does on every deploy and restart), which is how logos used to vanish.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { ORIGIN, adminToken, call, check, createMember, finish, key } from '../lib.mjs';

const UPLOAD_DIR = process.env.E2E_UPLOAD_DIR;
const T = await adminToken();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4 test bill for the upload flow');
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

const form = (field, bytes, type, name) => {
  const fd = new FormData();
  fd.append(field, new Blob([bytes], { type }), name);
  return fd;
};
const get = async (path, token) => {
  const r = await fetch(ORIGIN + path, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: r.status, type: r.headers.get('content-type'), cache: r.headers.get('cache-control'), bytes: Buffer.from(await r.arrayBuffer()) };
};
const filesOnDisk = (dir) => {
  if (!dir || !existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? filesOnDisk(join(dir, e.name)) : [join(dir, e.name)]));
};

// ── Upload one of each kind ────────────────────────────────────────────────
const logo = await call('POST', '/admin/settings/logo', { token: T, body: form('photo', PNG, 'image/png', 'logo.png') });
const logoUrl = logo.body?.settings?.logoUrl;
check('owner uploads the gym logo', logo.status === 200 && /^\/uploads\/avatars\/[\w.-]+\.png$/.test(logoUrl || ''), logo.body);
const logoFile = await get(logoUrl);
check('the logo is served with its type and a long cache', logoFile.status === 200 && logoFile.type === 'image/png' && logoFile.bytes.equals(PNG) && /immutable/.test(logoFile.cache), logoFile);

const { member, token: memberT } = await createMember(T);
const photo = await call('POST', `/admin/members/${member._id}/photo`, { token: T, body: form('photo', PNG, 'image/png', 'face.png') });
const photoUrl = photo.body?.member?.profilePhoto;
check('desk uploads a member photo', photo.status === 200 && Boolean(photoUrl), photo.body);

const expense = await call('POST', '/admin/expenses', { token: T, body: { category: 'rent', amount: 1000, date: today, mode: 'cash', vendor: 'Upload test' }, idem: key() });
const bill = await call('PUT', `/admin/expenses/${expense.body.expense._id}/bill`, { token: T, body: form('bill', PDF, 'application/pdf', 'bill.pdf') });
check('owner attaches a PDF bill', bill.status === 200 && bill.body.expense.bill?.name === 'bill.pdf', bill.body);

const progress = new FormData();
progress.append('pose', 'front');
progress.append('photo', new Blob([PNG], { type: 'image/png' }), 'front.png');
const pPhoto = await call('POST', '/member/progress/photos', { token: memberT, body: progress });
const pId = pPhoto.body?.photo?._id;
check('member uploads a progress photo', pPhoto.status === 201 && Boolean(pId), pPhoto.body);

// ── Nothing on the server's disk; a wiped disk loses nothing ───────────────
check('no uploaded file was written to the server disk', filesOnDisk(UPLOAD_DIR).length === 0, filesOnDisk(UPLOAD_DIR));
if (UPLOAD_DIR) rmSync(UPLOAD_DIR, { recursive: true, force: true });

const after = {
  logo: await get(logoUrl),
  photo: await get(photoUrl),
  bill: await get(`/api/admin/expenses/${expense.body.expense._id}/bill`, T),
  progress: await get(`/api/member/progress/photos/${pId}/file`, memberT),
};
check('after the disk is wiped: the logo still loads', after.logo.status === 200 && after.logo.bytes.equals(PNG), after.logo.status);
check('after the disk is wiped: the member photo still loads', after.photo.status === 200 && after.photo.bytes.equals(PNG), after.photo.status);
check('after the disk is wiped: the bill still downloads (private, no cache)', after.bill.status === 200 && after.bill.bytes.equals(PDF) && /no-store/.test(after.bill.cache), after.bill.status);
check('after the disk is wiped: the progress photo still streams', after.progress.status === 200 && after.progress.type === 'image/png', after.progress.status);

// ── Replaced and removed files are gone; odd paths are refused ─────────────
const logo2 = await call('POST', '/admin/settings/logo', { token: T, body: form('photo', PNG, 'image/png', 'logo2.png') });
check('replacing the logo removes the old file', logo2.status === 200 && (await get(logoUrl)).status === 404 && (await get(logo2.body.settings.logoUrl)).status === 200);
await call('DELETE', '/admin/settings/logo', { token: T });
check('removing the logo removes its file', (await get(logo2.body.settings.logoUrl)).status === 404);
check('a missing upload is a 404', (await get('/uploads/avatars/1700000000000-0000000000000000.png')).status === 404);
check('path tricks are refused', (await get('/uploads/avatars/..%2f..%2fpackage.json')).status === 404);
check('private files are never public', (await get(`/uploads/private/expense-bills/x.pdf`)).status === 404);

finish();
