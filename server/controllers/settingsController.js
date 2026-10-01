import Settings, { getSettingsDoc } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { removeAvatar } from '../services/storageService.js';

const PUBLIC_FIELDS = [
  'gymName', 'logoUrl', 'registrationFee', 'heroBackgroundImage', 'heroHeadline', 'heroDescription', 'address', 'phone', 'email',
  'facebook', 'instagram', 'whatsapp', 'mapEmbedUrl', 'openingHours', 'holidays',
];

/** Settings groups whose fields are patched individually, so saving one field keeps the others. */
const NESTED_GROUPS = ['payments', 'reminders'];

/** { payments: { upiId } } → { 'payments.upiId': … }; arrays and other fields are replaced whole. */
export function toSettingsUpdate(patch) {
  const set = {};
  for (const [key, value] of Object.entries(patch)) {
    if (NESTED_GROUPS.includes(key) && value && typeof value === 'object' && !Array.isArray(value)) {
      for (const [inner, v] of Object.entries(value)) if (v !== undefined) set[`${key}.${inner}`] = v;
    } else if (value !== undefined) {
      set[key] = value;
    }
  }
  return set;
}

/** GET /api/settings — public website content (billing settings stay private). */
export const getPublicSettings = asyncHandler(async (req, res) => {
  const settings = await getSettingsDoc();
  res.json(Object.fromEntries(PUBLIC_FIELDS.map((k) => [k, settings[k]])));
});

/** GET /api/admin/settings */
export const getSettings = asyncHandler(async (req, res) => {
  res.json({ success: true, settings: await getSettingsDoc() });
});

/** PATCH /api/admin/settings */
export const updateSettings = asyncHandler(async (req, res) => {
  const settings = await Settings.findOneAndUpdate({}, { $set: toSettingsUpdate(req.validated.body) }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  res.json({ success: true, settings });
});

/** POST /api/admin/settings/logo — multipart field `photo` (checked as a real image by avatarUpload). */
export const uploadLogo = asyncHandler(async (req, res) => {
  const before = await getSettingsDoc();
  const settings = await Settings.findOneAndUpdate({}, { $set: { logoUrl: req.avatarUrl } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  if (before.logoUrl && before.logoUrl !== req.avatarUrl) await removeAvatar(before.logoUrl);
  res.json({ success: true, settings });
});

/** DELETE /api/admin/settings/logo */
export const removeLogo = asyncHandler(async (req, res) => {
  const before = await getSettingsDoc();
  const settings = await Settings.findOneAndUpdate({}, { $set: { logoUrl: '' } }, { new: true, upsert: true, setDefaultsOnInsert: true }).lean();
  await removeAvatar(before.logoUrl);
  res.json({ success: true, settings });
});
