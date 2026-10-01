import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarPlus, Clock, Copy, ImageUp, Plus, Store, Trash2, X } from "lucide-react";
import { useGymLogo, useUpdateSettings } from "./api";
import { DAY_NAMES, WEEK_ORDER, hoursProblems, normaliseWeek, openState } from "./hours";
import { prepareLogo } from "./logo";
import { Badge, Button, Card, CardHeader, Field, FormError, IconButton, InlineAlert, Input, Switch, useConfirm, useToast } from "../../shared/ui";
import { formatDate, gymDayKey } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

/**
 * OWNER: security, staff & settings module. Settings section "Logo, hours and holidays".
 * Receives { settings, readOnly } from SettingsPage.
 */
export default function GymProfileSettings({ settings, readOnly }) {
  return (
    <div className="flex flex-col gap-5">
      <LogoCard settings={settings} readOnly={readOnly} />
      <HoursCard settings={settings} readOnly={readOnly} />
      <HolidaysCard settings={settings} readOnly={readOnly} />
    </div>
  );
}

function LogoCard({ settings, readOnly }) {
  const { upload, remove } = useGymLogo();
  const toast = useToast();
  const confirm = useConfirm();
  const inputRef = useRef(null);
  const [error, setError] = useState(null);

  const choose = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    try {
      const logo = await prepareLogo(file);
      upload.mutate(logo, { onSuccess: () => toast.success("Logo saved") });
    } catch (err) {
      setError(err.message);
    }
  };

  const clear = async () => {
    const ok = await confirm({
      title: "Remove the gym logo?",
      body: "Receipts and the app go back to the Kovij mark.",
      confirmLabel: "Remove",
      tone: "danger",
    });
    if (ok)
      remove.mutate(undefined, {
        onSuccess: () => toast.success("Logo removed"),
      });
  };

  return (
    <Card padding="lg">
      <CardHeader title="Gym logo" description="Shown on receipts, emails, the check-in kiosk and the app." />
      <div className="flex flex-wrap items-center gap-5">
        <div className="grid size-24 shrink-0 place-items-center overflow-hidden rounded-tile border border-line bg-surface-2">
          {settings.logoUrl ? (
            <img src={settings.logoUrl} alt={`${settings.gymName || "Gym"} logo`} className="size-full object-contain p-2" />
          ) : (
            <Store className="size-8 text-ink-3" aria-hidden />
          )}
        </div>
        {!readOnly && (
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={ImageUp} loading={upload.isPending} onClick={() => inputRef.current?.click()}>
                {settings.logoUrl ? "Replace logo" : "Upload logo"}
              </Button>
              {settings.logoUrl && (
                <Button variant="ghost" icon={Trash2} loading={remove.isPending} onClick={clear}>
                  Remove
                </Button>
              )}
            </div>
            <p className="text-[13px] text-ink-3">PNG, JPEG or WebP. A square or wide logo on a plain background works best.</p>
            <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={choose} tabIndex={-1} aria-hidden />
          </div>
        )}
      </div>
      {error && (
        <InlineAlert tone="bad" className="mt-4">
          {error}
        </InlineAlert>
      )}
      <FormError error={upload.error || remove.error} />
    </Card>
  );
}

function OpenNow({ openingHours, holidays }) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  const state = openState(openingHours, holidays, now);
  return (
    <Badge tone={state.open ? "good" : "neutral"} icon={Clock}>
      {state.label}
    </Badge>
  );
}

function HoursCard({ settings, readOnly }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const initial = useMemo(() => normaliseWeek(settings.openingHours), [settings.openingHours]);
  const [week, setWeek] = useState(initial);
  const [tried, setTried] = useState(false);
  useEffect(() => setWeek(initial), [initial]);

  const dirty = JSON.stringify(week) !== JSON.stringify(initial);
  const problems = hoursProblems(week);
  const setDay = (day, patch) => setWeek((w) => w.map((d) => (d.day === day ? { ...d, ...patch } : d)));
  const setSlot = (day, i, patch) =>
    setWeek((w) =>
      w.map((d) =>
        d.day === day
          ? {
              ...d,
              slots: d.slots.map((s, j) => (j === i ? { ...s, ...patch } : s)),
            }
          : d,
      ),
    );

  const copyMonday = () => {
    const monday = week[1];
    setWeek((w) =>
      w.map((d) =>
        d.day >= 2 && d.day <= 6
          ? {
              ...d,
              closed: monday.closed,
              slots: monday.slots.map((s) => ({ ...s })),
            }
          : d,
      ),
    );
  };

  const save = (e) => {
    e.preventDefault();
    setTried(true);
    if (Object.keys(problems).length) return;
    update.mutate(
      { openingHours: week },
      {
        onSuccess: () => (toast.success("Opening hours saved"), setTried(false)),
      },
    );
  };

  return (
    <Card padding="lg">
      <CardHeader
        title="Opening hours"
        description="Up to two sessions a day, in gym time. Used by the kiosk, reminders and the member app."
      />
      <div className="-mt-1 mb-4">
        <OpenNow openingHours={settings.openingHours} holidays={settings.holidays} />
      </div>
      <form onSubmit={save} noValidate>
        <FormError error={update.error} />
        <fieldset disabled={readOnly} className="flex flex-col divide-y divide-line">
          {WEEK_ORDER.map((dayIndex) => {
            const d = week[dayIndex];
            const dayProblem = tried && problems[d.day];
            return (
              <div key={d.day} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-start">
                <div className="flex items-center justify-between gap-3 sm:w-44 sm:shrink-0 sm:pt-2">
                  <span className="font-semibold">{DAY_NAMES[d.day]}</span>
                  <div className="sm:hidden">
                    <Switch
                      label={<span className="sr-only">Open on {DAY_NAMES[d.day]}</span>}
                      checked={!d.closed}
                      onChange={(open) =>
                        setDay(d.day, {
                          closed: !open,
                          slots: open && !d.slots.length ? [{ open: "06:00", close: "10:00" }] : d.slots,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-2">
                  {d.closed ? (
                    <p className="pt-2 text-sm text-ink-3">Closed</p>
                  ) : (
                    d.slots.map((s, i) => {
                      const slotProblem = tried && problems[`${d.day}.${i}`];
                      return (
                        <div key={i}>
                          {/* Phones: the two times share the full row so AM/PM stays visible; remove sits below. */}
                          <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:flex-wrap">
                            <div className="sm:w-36">
                              <Input
                                type="time"
                                aria-label={`${DAY_NAMES[d.day]} session ${i + 1} opens`}
                                value={s.open}
                                onChange={(e) => setSlot(d.day, i, { open: e.target.value })}
                                aria-invalid={Boolean(slotProblem)}
                              />
                            </div>
                            <span className="text-ink-3" aria-hidden>
                              to
                            </span>
                            <div className="sm:w-36">
                              <Input
                                type="time"
                                aria-label={`${DAY_NAMES[d.day]} session ${i + 1} closes`}
                                value={s.close}
                                onChange={(e) => setSlot(d.day, i, { close: e.target.value })}
                                aria-invalid={Boolean(slotProblem)}
                              />
                            </div>
                            {!readOnly && d.slots.length > 1 && (
                              <IconButton
                                icon={X}
                                label={`Remove ${DAY_NAMES[d.day]} session ${i + 1}`}
                                variant="ghost"
                                size="sm"
                                className="max-sm:hidden"
                                onClick={() => setDay(d.day, { slots: d.slots.filter((_, j) => j !== i) })}
                              />
                            )}
                          </div>
                          {!readOnly && d.slots.length > 1 && (
                            <button
                              type="button"
                              onClick={() => setDay(d.day, { slots: d.slots.filter((_, j) => j !== i) })}
                              className="mt-1 inline-flex min-h-8 items-center gap-1 text-[13px] font-semibold text-ink-3 hover:text-ink sm:hidden"
                            >
                              <X className="size-3.5" aria-hidden />
                              Remove {i === 0 ? "morning" : "evening"} session
                            </button>
                          )}
                          {slotProblem && <p className="mt-1 text-[13px] text-bad">{slotProblem}</p>}
                        </div>
                      );
                    })
                  )}
                  {!readOnly && !d.closed && d.slots.length < 2 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDay(d.day, {
                          slots: [...d.slots, d.slots.length ? { open: "16:00", close: "21:00" } : { open: "06:00", close: "10:00" }],
                        })
                      }
                      className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-brand-ink hover:underline"
                    >
                      <Plus className="size-3.5" aria-hidden />
                      {d.slots.length ? "Add evening session" : "Add a session"}
                    </button>
                  )}
                  {dayProblem && <p className="text-[13px] text-bad">{dayProblem}</p>}
                </div>
                <div className="hidden sm:block sm:pt-1.5">
                  <Switch
                    label={<span className="sr-only">Open on {DAY_NAMES[d.day]}</span>}
                    checked={!d.closed}
                    onChange={(open) =>
                      setDay(d.day, {
                        closed: !open,
                        slots: open && !d.slots.length ? [{ open: "06:00", close: "10:00" }] : d.slots,
                      })
                    }
                  />
                </div>
              </div>
            );
          })}
        </fieldset>
        {!readOnly && (
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <Button variant="ghost" icon={Copy} onClick={copyMonday}>
              Copy Monday to Tue–Sat
            </Button>
            <div className="flex gap-2">
              {dirty && (
                <Button variant="ghost" onClick={() => (setWeek(initial), setTried(false))}>
                  Undo changes
                </Button>
              )}
              <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty}>
                Save hours
              </Button>
            </div>
          </div>
        )}
      </form>
    </Card>
  );
}

function HolidaysCard({ settings, readOnly }) {
  const update = useUpdateSettings();
  const toast = useToast();
  const [form, setForm] = useState({ date: "", name: "" });
  const [error, setError] = useState(null);
  const today = gymDayKey();
  const holidays = useMemo(() => [...(settings.holidays || [])].sort((a, b) => a.date.localeCompare(b.date)), [settings.holidays]);
  const upcoming = holidays.filter((h) => h.date >= today);
  const past = holidays.filter((h) => h.date < today);

  const save = (list, message) => update.mutate({ holidays: list.map(({ date, name }) => ({ date, name })) }, { onSuccess: () => toast.success(message) });

  const add = (e) => {
    e.preventDefault();
    if (!form.date) return setError({ date: "Pick a date" });
    if (!form.name.trim()) return setError({ name: "Name the holiday" });
    if (holidays.some((h) => h.date === form.date)) return setError({ date: "This date is already a holiday" });
    setError(null);
    save([...holidays, { date: form.date, name: form.name.trim() }], "Holiday added");
    setForm({ date: "", name: "" });
  };

  return (
    <Card padding="lg">
      <CardHeader title="Holidays" description="Days the gym is closed. Members see them in the app, and the kiosk shows the gym as closed." />
      <FormError error={update.error} />
      {!readOnly && (
        <form onSubmit={add} className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end" noValidate>
          <Field label="Date" error={error?.date}>
            <Input type="date" min={today} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Name" error={error?.name}>
            <Input value={form.name} maxLength={80} placeholder="e.g. Diwali" onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Button type="submit" variant="secondary" icon={CalendarPlus} loading={update.isPending} className="sm:mb-0.5">
            Add holiday
          </Button>
        </form>
      )}
      {upcoming.length === 0 ? (
        <p className="text-sm text-ink-3">No upcoming holidays.</p>
      ) : (
        <ul className="-mx-2 flex flex-col">
          {upcoming.map((h) => (
            <HolidayRow
              key={h.date}
              holiday={h}
              readOnly={readOnly}
              onRemove={() =>
                save(
                  holidays.filter((x) => x.date !== h.date),
                  "Holiday removed",
                )
              }
            />
          ))}
        </ul>
      )}
      {past.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[13px] font-semibold text-ink-3">Past holidays ({past.length})</summary>
          <ul className="-mx-2 mt-2 flex flex-col">
            {past.map((h) => (
              <HolidayRow
                key={h.date}
                holiday={h}
                past
                readOnly={readOnly}
                onRemove={() =>
                  save(
                    holidays.filter((x) => x.date !== h.date),
                    "Holiday removed",
                  )
                }
              />
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function HolidayRow({ holiday, past = false, readOnly, onRemove }) {
  return (
    <li className={cn("flex items-center gap-3 rounded-tile px-2 py-2.5", past && "text-ink-3")}>
      <span className="tabular w-28 shrink-0 text-sm">{formatDate(`${holiday.date}T12:00:00+05:30`)}</span>
      <span className="min-w-0 flex-1 truncate font-medium">{holiday.name}</span>
      {!readOnly && <IconButton icon={Trash2} label={`Remove ${holiday.name}`} variant="ghost" size="sm" onClick={onRemove} />}
    </li>
  );
}
