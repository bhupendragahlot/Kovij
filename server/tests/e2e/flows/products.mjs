// Shop products: managed by owner/managers in the staff app, shown on the website when visible.
import { ORIGIN, adminToken, call, check, finish, staffToken, uniq } from '../lib.mjs';

const T = await adminToken();
const manager = await staffToken('manager', T);
const desk = await staffToken('staff', T);
const trainer = await staffToken('trainer', T);
const M = manager.token;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const photoForm = (bytes = PNG, type = 'image/png') => {
  const fd = new FormData();
  fd.append('photo', new Blob([bytes], { type }), 'product.png');
  return fd;
};
const status = async (path) => (await fetch(ORIGIN + path)).status;

// ── Access ─────────────────────────────────────────────────────────────────
check('front desk cannot see the staff product list (403)', (await call('GET', '/products/manage', { token: desk.token })).status === 403);
check('trainer cannot add products (403)', (await call('POST', '/products', { token: trainer.token, body: {} })).status === 403);
check('product photos need a staff session (401)', (await call('POST', '/products/image', { body: photoForm() })).status === 401);

// ── Photo upload ───────────────────────────────────────────────────────────
const up = await call('POST', '/products/image', { token: M, body: photoForm() });
check('manager uploads a product photo', up.status === 201 && /^\/uploads\/avatars\/[\w.-]+\.png$/.test(up.body.url || ''), up.body);
check('the photo is served', (await status(up.body.url)) === 200);
const fake = await call('POST', '/products/image', { token: M, body: photoForm(Buffer.from('not an image at all, honestly'), 'image/png') });
check('a fake image is refused (422)', fake.status === 422 && fake.body.code === 'INVALID_FILE_TYPE', fake.body);

// ── Create and validate ────────────────────────────────────────────────────
const sku = uniq('WPI-');
const base = { name: 'Whey Protein Isolate 1 kg', brand: 'Kovij Labs', sku, category: 'protein', price: 2499, discountPrice: 1999, stock: 12, image: up.body.url, badge: 'Best seller', description: 'Unflavoured.' };
const created = await call('POST', '/products', { token: M, body: base });
check('manager adds a product', created.status === 201 && created.body.sku === sku && created.body.showOnFrontend === true, created.body);
const P = created.body._id;

const bad = await call('POST', '/products', { token: M, body: { ...base, sku: uniq('X-'), name: '', price: 500, discountPrice: 700, image: 'javascript:alert(1)', category: 'cake' } });
check(
  'validation names each field in plain words (422)',
  bad.status === 422 && bad.body.details.fields.name === 'Name the product' && bad.body.details.fields.category === 'Choose a category' && /Upload a photo/.test(bad.body.details.fields.image),
  bad.body
);
const sale = await call('POST', '/products', { token: M, body: { ...base, sku: uniq('S-'), discountPrice: 2499 } });
check('the sale price must be below the price (422)', sale.status === 422 && /lower than the price/.test(sale.body.details.fields.discountPrice), sale.body);
const dup = await call('POST', '/products', { token: M, body: { ...base, name: 'Copy' } });
check('a used SKU is refused on its field (409)', dup.status === 409 && dup.body.code === 'DUPLICATE_SKU' && dup.body.details.fields.sku, dup.body);

// ── Website visibility ─────────────────────────────────────────────────────
const hidden = await call('POST', '/products', { token: T, body: { ...base, sku: uniq('H-'), name: 'Hidden shaker', category: 'accessories', discountPrice: undefined, price: 399, showOnFrontend: false } });
check('owner adds a hidden product', hidden.status === 201 && hidden.body.showOnFrontend === false, hidden.body);
const publicList = await call('GET', '/products');
check('the website lists visible products only', publicList.body.products.some((p) => p._id === P) && !publicList.body.products.some((p) => p._id === hidden.body._id));
check('a hidden product is not public (404)', (await call('GET', `/products/${hidden.body._id}`)).status === 404);
const staffList = await call('GET', '/products/manage', { token: M });
check('staff see hidden products too', staffList.status === 200 && staffList.body.products.some((p) => p._id === hidden.body._id), staffList.status);

// ── Edit: new photo replaces the old file; the sale price can be removed ───
const up2 = await call('POST', '/products/image', { token: M, body: photoForm() });
const edited = await call('PUT', `/products/${P}`, { token: M, body: { ...base, image: up2.body.url, discountPrice: null, price: 2299 } });
check('edit the price, photo and remove the sale price', edited.status === 200 && edited.body.price === 2299 && edited.body.discountPrice == null && edited.body.image === up2.body.url, edited.body);
check('the replaced photo is removed', (await status(up.body.url)) === 404 && (await status(up2.body.url)) === 200);

// ── Delete ─────────────────────────────────────────────────────────────────
check('front desk cannot delete products (403)', (await call('DELETE', `/products/${P}`, { token: desk.token })).status === 403);
const del = await call('DELETE', `/products/${P}`, { token: M });
check('manager deletes a product and its photo', del.status === 200 && (await call('GET', `/products/${P}`)).status === 404 && (await status(up2.body.url)) === 404, del.body);
await call('DELETE', `/products/${hidden.body._id}`, { token: T });

finish();
