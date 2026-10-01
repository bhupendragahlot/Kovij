/**
 * Opening hours helpers (gym time, Asia/Kolkata). Data shape, as stored in settings:
 *   openingHours: [{ day: 0-6 (0 = Sunday), closed: bool, slots: [{ open: "06:00", close: "11:00" }] }]
 *   holidays:     [{ date: "YYYY-MM-DD", name }]
 */
export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
/** Display order: the week starts on Monday. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

const TZ = "Asia/Kolkata";
const partsFmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" });
const WEEKDAY = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** { day, time: "HH:MM", date: "YYYY-MM-DD" } in gym time. */
export function gymNow(now = new Date()) {
  const p = Object.fromEntries(partsFmt.formatToParts(now).map((x) => [x.type, x.value]));
  return { day: WEEKDAY[p.weekday], time: `${p.hour}:${p.minute}`, date: `${p.year}-${p.month}-${p.day}` };
}

const addDays = (date, n) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

/** "06:00" → "6 am", "16:30" → "4:30 pm" */
export function formatClock(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return m ? `${h12}:${String(m).padStart(2, "0")} ${suffix}` : `${h12} ${suffix}`;
}

/** Every weekday present, in 0-6 order, sessions sorted. */
export function normaliseWeek(openingHours = []) {
  return [0, 1, 2, 3, 4, 5, 6].map((day) => {
    const found = openingHours.find((d) => d.day === day);
    const slots = [...(found?.slots || [])].map((s) => ({ open: s.open, close: s.close })).sort((a, b) => a.open.localeCompare(b.open));
    return { day, closed: found ? Boolean(found.closed) : true, slots };
  });
}

/** Problems keyed like "1" (whole day) or "1.0" (a session), mirroring the server's rules. */
export function hoursProblems(week) {
  const problems = {};
  for (const d of week) {
    if (d.closed) continue;
    const name = DAY_NAMES[d.day];
    if (!d.slots.length) problems[d.day] = `${name}: add opening hours or mark it closed`;
    d.slots.forEach((s, i) => {
      if (!s.open || !s.close) problems[`${d.day}.${i}`] = "Fill in both times";
      else if (s.open >= s.close) problems[`${d.day}.${i}`] = "Closing time must be after opening time";
    });
    const sorted = [...d.slots].filter((s) => s.open && s.close).sort((a, b) => a.open.localeCompare(b.open));
    for (let k = 1; k < sorted.length; k += 1) if (sorted[k].open < sorted[k - 1].close) problems[d.day] = `${name}: the two sessions overlap`;
  }
  return problems;
}

/**
 * Is the gym open right now, and what happens next?
 * @returns {{ open: boolean, label: string, holiday?: string }}
 */
export function openState(openingHours, holidays = [], now = new Date()) {
  const week = normaliseWeek(openingHours);
  const { day, time, date } = gymNow(now);
  const holidayOn = (d) => holidays.find((h) => h.date === d);

  const todayHoliday = holidayOn(date);
  const today = week[day];
  if (!todayHoliday && !today.closed) {
    const current = today.slots.find((s) => s.open <= time && time < s.close);
    if (current) return { open: true, label: `Open now · closes at ${formatClock(current.close)}` };
    const later = today.slots.find((s) => s.open > time);
    if (later) return { open: false, label: `Closed now · opens at ${formatClock(later.open)}` };
  }

  // Look ahead up to a week for the next session.
  for (let i = 1; i <= 7; i += 1) {
    const d = addDays(date, i);
    const wd = (day + i) % 7;
    const next = week[wd];
    if (holidayOn(d) || next.closed || !next.slots.length) continue;
    const when = i === 1 ? "tomorrow" : DAY_NAMES[wd];
    return {
      open: false,
      label: `${todayHoliday ? `Closed today for ${todayHoliday.name}` : "Closed now"} · opens ${when} at ${formatClock(next.slots[0].open)}`,
      holiday: todayHoliday?.name,
    };
  }
  return { open: false, label: todayHoliday ? `Closed today for ${todayHoliday.name}` : "Closed", holiday: todayHoliday?.name };
}
