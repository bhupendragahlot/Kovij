import { CopyCheck, Plus, X } from "lucide-react";
import { WEEKDAYS } from "../labels";
import { Button, IconButton, Input, Switch } from "../../../shared/ui";

const MAX_SHIFTS = 3;
const DEFAULT_SHIFT = { start: "06:00", end: "11:00" };

/**
 * Weekly floor hours: each weekday on or off, with up to three shifts.
 * `value` is [{ day, shifts: [{ start, end }] }] (only working days); errors are keyed like
 * the server's ("schedule.<index>.shifts.<n>.end").
 */
export function ScheduleEditor({ value = [], onChange, errors = {} }) {
  const byDay = new Map(value.map((d) => [d.day, d]));
  const order = [1, 2, 3, 4, 5, 6, 0]; // Monday first, as the gym's week reads

  const commit = (map) =>
    onChange(
      [...map.values()]
        .filter((d) => d.shifts.length)
        .sort((a, b) => a.day - b.day)
    );

  const setDay = (day, shifts) => {
    const map = new Map(byDay);
    map.set(day, { day, shifts });
    commit(map);
  };

  const copyToWeekdays = (day) => {
    const source = byDay.get(day);
    if (!source) return;
    const map = new Map(byDay);
    for (const d of [1, 2, 3, 4, 5, 6]) map.set(d, { day: d, shifts: source.shifts.map((s) => ({ ...s })) });
    commit(map);
  };

  // Error paths refer to positions in the saved array (sorted by day).
  const indexOf = (day) => value.findIndex((d) => d.day === day);
  const errorFor = (day, k, field) => errors[`schedule.${indexOf(day)}.shifts.${k}.${field}`];

  return (
    <div className="flex flex-col divide-y divide-line rounded-tile border border-line">
      {order.map((day) => {
        const entry = byDay.get(day);
        const on = Boolean(entry?.shifts.length);
        return (
          <div key={day} className="flex flex-col gap-3 p-3">
            <Switch label={WEEKDAYS[day]} description={on ? undefined : "Off"} checked={on} onChange={(v) => setDay(day, v ? [{ ...DEFAULT_SHIFT }] : [])} />
            {on && (
              <>
                {entry.shifts.map((s, k) => {
                  const startErr = errorFor(day, k, "start");
                  const endErr = errorFor(day, k, "end");
                  return (
                    <div key={k}>
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          aria-label={`${WEEKDAYS[day]} shift ${k + 1} starts`}
                          aria-invalid={startErr ? true : undefined}
                          value={s.start}
                          onChange={(e) => setDay(day, entry.shifts.map((x, j) => (j === k ? { ...x, start: e.target.value } : x)))}
                        />
                        <span className="text-sm text-ink-3" aria-hidden>
                          to
                        </span>
                        <Input
                          type="time"
                          aria-label={`${WEEKDAYS[day]} shift ${k + 1} ends`}
                          aria-invalid={endErr ? true : undefined}
                          value={s.end}
                          onChange={(e) => setDay(day, entry.shifts.map((x, j) => (j === k ? { ...x, end: e.target.value } : x)))}
                        />
                        <IconButton icon={X} label={`Remove ${WEEKDAYS[day]} shift ${k + 1}`} onClick={() => setDay(day, entry.shifts.filter((_, j) => j !== k))} />
                      </div>
                      {(startErr || endErr) && <p className="mt-1 text-[13px] font-medium text-bad">{startErr || endErr}</p>}
                    </div>
                  );
                })}
                <div className="flex flex-wrap gap-2">
                  {entry.shifts.length < MAX_SHIFTS && (
                    <Button variant="quiet" icon={Plus} onClick={() => setDay(day, [...entry.shifts, { start: "16:00", end: "21:00" }])}>
                      Add shift
                    </Button>
                  )}
                  {day !== 0 && (
                    <Button variant="ghost" icon={CopyCheck} onClick={() => copyToWeekdays(day)}>
                      Same for Mon–Sat
                    </Button>
                  )}
                </div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
