import { BadgePercent, CalendarClock, CalendarOff, CircleCheck, Clock, EyeOff, Info, PartyPopper, PencilLine } from "lucide-react";
import { GYM_TZ } from "../../shared/lib/format";

export const CATEGORY = {
  event: { label: "Event", icon: PartyPopper },
  offer: { label: "Offer", icon: BadgePercent },
  holiday: { label: "Holiday", icon: CalendarOff },
  notice: { label: "Notice", icon: Info },
};

/** Display state from the server (`state`): live and ended are both "published". */
export const ANNOUNCEMENT_STATE = {
  live: { tone: "good", icon: CircleCheck, label: "Live" },
  scheduled: { tone: "info", icon: CalendarClock, label: "Scheduled" },
  draft: { tone: "neutral", icon: PencilLine, label: "Draft" },
  ended: { tone: "neutral", icon: Clock, label: "Ended" },
  unpublished: { tone: "neutral", icon: EyeOff, label: "Unpublished" },
};

// India has no daylight saving, so gym time is always +05:30.
const GYM_OFFSET = "+05:30";
const partsFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: GYM_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** Date → "YYYY-MM-DDTHH:mm" in gym time, for <input type="datetime-local">. */
export function toGymInput(value) {
  if (!value) return "";
  const p = Object.fromEntries(partsFormat.formatToParts(new Date(value)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** "YYYY-MM-DDTHH:mm" typed in gym time → ISO string (whatever the device's clock zone is). */
export const fromGymInput = (value) => (value ? new Date(`${value}:00${GYM_OFFSET}`).toISOString() : null);

/** Last moment of a gym day, for "show until". */
export const endOfGymDayIso = (dayKey) => (dayKey ? new Date(`${dayKey}T23:59:59${GYM_OFFSET}`).toISOString() : null);
