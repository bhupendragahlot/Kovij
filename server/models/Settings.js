import mongoose from 'mongoose';

/** Single document holding gym profile, billing defaults, and public-website content. */
const SettingSchema = new mongoose.Schema(
  {
    gymName: { type: String, default: 'Kovij Fitness Zone', trim: true },
    /** One-time fee added to a member's first membership. Set by the owner, never by the member. */
    registrationFee: { type: Number, default: 0, min: 0 },
    invoicePrefix: { type: String, default: 'KFZ', trim: true, uppercase: true, maxlength: 8 },
    /** Days before plan end that a membership counts as "expiring" on the dashboard. */
    expiringWindowDays: { type: Number, default: 7, min: 1, max: 60 },

    heroBackgroundImage: {
      type: String,
      default: 'https://c1.wallpaperflare.com/preview/497/845/200/gym-strong-fitness-athlete.jpg',
    },
    heroHeadline: {
      type: String,
      default: 'TRANSFORM YOUR BODY, TRANSFORM YOUR LIFE',
    },
    heroDescription: {
      type: String,
      default:
        'Achieve your fitness goals with state-of-the-art equipment, expert trainers, and a motivating environment.',
    },
    address: { type: String, default: '' },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    facebook: { type: String },
    instagram: { type: String },
    whatsapp: { type: String },
    mapEmbedUrl: {
      type: String,
      default:
        'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d3712.1985550394793!2d75.89803922711107!3d25.179997694741587!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x396f911faffd7c31%3A0xec54a1034fdf7b9a!2sKovij%20Fitness%20Zone!5e0!3m2!1sen!2sin!4v1742579483445!5m2!1sen!2sin',
    },

    logoUrl: { type: String, default: '' },

    /** Weekly hours, day 0 = Sunday. One source for the website, member app and "gym open" checks. */
    openingHours: {
      type: [
        {
          _id: false,
          day: { type: Number, min: 0, max: 6, required: true },
          closed: { type: Boolean, default: false },
          slots: [{ _id: false, open: String, close: String }],
        },
      ],
      default: () => [
        { day: 0, closed: true, slots: [] },
        ...[1, 2, 3, 4, 5, 6].map((day) => ({ day, closed: false, slots: [{ open: '06:00', close: '11:00' }, { open: '16:00', close: '21:00' }] })),
      ],
    },
    /** Closed days, e.g. Diwali. `date` is YYYY-MM-DD in gym time. */
    holidays: { type: [{ _id: false, date: String, name: String }], default: [] },

    payments: {
      /** UPI ID for "pay by UPI" links and QR codes (no gateway needed). */
      upiId: { type: String, default: '', trim: true },
      payeeName: { type: String, default: '', trim: true },
      /** Card/UPI checkout through a payment gateway (needs gateway keys on the server). */
      onlineEnabled: { type: Boolean, default: false },
      acceptCash: { type: Boolean, default: true },
      acceptUpi: { type: Boolean, default: true },
      acceptCard: { type: Boolean, default: true },
      /** Allow collecting part of a due and leaving the rest pending. */
      allowPartial: { type: Boolean, default: true },
    },

    /** Automatic reminder emails/notifications (see cron/). */
    reminders: {
      enabled: { type: Boolean, default: true },
      /** Days before a plan ends to remind the member (only if they haven't renewed). */
      expiryDaysBefore: { type: [Number], default: () => [7, 3, 1] },
      onExpiryDay: { type: Boolean, default: true },
      /** Days after a plan ended to send a "come back" message (only if still not renewed). */
      afterExpiryDays: { type: [Number], default: () => [3, 7] },
      paymentDue: { type: Boolean, default: true },
      paymentDueEveryDays: { type: Number, default: 3, min: 1, max: 30 },
      birthday: { type: Boolean, default: true },
      /** Hour of day (gym time) when reminders go out. */
      sendHour: { type: Number, default: 9, min: 6, max: 21 },
    },
  },
  { timestamps: true }
);

const Settings = mongoose.model('Settings', SettingSchema);

/** Settings always resolve, even before the owner has saved anything. */
export async function getSettingsDoc() {
  const existing = await Settings.findOne().lean();
  if (existing) return existing;
  return new Settings().toObject();
}

export default Settings;
