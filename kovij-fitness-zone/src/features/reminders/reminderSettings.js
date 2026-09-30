/** Mirrors server/services/reminderRules.js normalizeReminderSettings for display. */
export const DEFAULT_REMINDERS = {
  enabled: true,
  expiryDaysBefore: [1, 3, 7],
  onExpiryDay: true,
  afterExpiryDays: [3, 7],
  paymentDue: true,
  paymentDueEveryDays: 3,
  birthday: true,
  sendHour: 9,
};

export const SEND_HOURS = Array.from({ length: 16 }, (_, i) => i + 6); // 6 am – 9 pm

/** 9 → "9 am", 21 → "9 pm" */
export const hourLabel = (h) => `${h % 12 === 0 ? 12 : h % 12} ${h < 12 ? "am" : "pm"}`;

const days = (list, fallback) => (Array.isArray(list) ? [...new Set(list.map(Number))].filter((n) => n > 0).sort((a, b) => a - b) : fallback);

export function normalizeReminders(r) {
  const raw = r || {};
  return {
    enabled: raw.enabled !== false,
    expiryDaysBefore: days(raw.expiryDaysBefore, DEFAULT_REMINDERS.expiryDaysBefore),
    onExpiryDay: raw.onExpiryDay !== false,
    afterExpiryDays: days(raw.afterExpiryDays, DEFAULT_REMINDERS.afterExpiryDays),
    paymentDue: raw.paymentDue !== false,
    paymentDueEveryDays: Number(raw.paymentDueEveryDays) || DEFAULT_REMINDERS.paymentDueEveryDays,
    birthday: raw.birthday !== false,
    sendHour: Number.isInteger(raw.sendHour) ? raw.sendHour : DEFAULT_REMINDERS.sendHour,
  };
}
