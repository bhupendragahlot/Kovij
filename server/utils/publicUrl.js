/**
 * Absolute links to the public site, for places that can't use relative paths: emails, receipts
 * opened from an inbox, link previews. Base: APP_URL (e.g. https://kovijfitness.in).
 */
const DEFAULT_APP_URL = 'https://kovij.onrender.com';

export const appBaseUrl = () => (process.env.APP_URL || DEFAULT_APP_URL).trim().replace(/\/+$/, '');

/** "/uploads/avatars/x.png" → "https://site/uploads/avatars/x.png"; full https links pass through. */
export function absoluteAppUrl(pathOrUrl) {
  const v = String(pathOrUrl || '').trim();
  if (!v) return '';
  if (/^https?:\/\//i.test(v)) return v;
  if (!v.startsWith('/')) return '';
  return `${appBaseUrl()}${v}`;
}

/** Brand images shipped with the site (kovij-fitness-zone/public). */
export const BRAND_IMAGES = {
  logoOnLight: '/brand/png/kovij-logo-horizontal-600.png',
  logoOnDark: '/brand/png/kovij-logo-horizontal-on-dark-600.png',
  mark: '/icons/icon-192.png',
};
