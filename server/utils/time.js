import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc.js';
import timezone from 'dayjs/plugin/timezone.js';

dayjs.extend(utc);
dayjs.extend(timezone);

/** All business-day boundaries (check-ins, revenue months, reminders) use the gym's local time. */
export const GYM_TZ = process.env.GYM_TIMEZONE || 'Asia/Kolkata';

export const toGymTime = (value = new Date()) => dayjs(value).tz(GYM_TZ);

/** `YYYY-MM-DD` in gym time — the natural key for "one check-in per member per day". */
export const gymDayKey = (value = new Date()) => toGymTime(value).format('YYYY-MM-DD');

export const startOfGymDay = (value = new Date()) => toGymTime(value).startOf('day').toDate();
export const endOfGymDay = (value = new Date()) => toGymTime(value).endOf('day').toDate();
export const startOfGymMonth = (value = new Date()) => toGymTime(value).startOf('month').toDate();

/** Parse a `YYYY-MM-DD` string as a gym-local calendar day. */
export const parseGymDay = (dayKey) => dayjs.tz(dayKey, 'YYYY-MM-DD', GYM_TZ);

export { dayjs };
