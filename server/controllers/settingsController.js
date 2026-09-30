import Settings, { getSettingsDoc } from '../models/Settings.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const PUBLIC_FIELDS = [
  'gymName', 'registrationFee', 'heroBackgroundImage', 'heroHeadline', 'heroDescription', 'address', 'phone', 'email',
  'facebook', 'instagram', 'whatsapp', 'mapEmbedUrl',
];

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
  const settings = await Settings.findOneAndUpdate({}, { $set: req.validated.body }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean();
  res.json({ success: true, settings });
});
