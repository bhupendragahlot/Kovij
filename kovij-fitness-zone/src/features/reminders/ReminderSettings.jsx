import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Cake, CalendarClock, Clock, HeartHandshake, IndianRupee } from "lucide-react";
import { useUpdateReminderSettings } from "./api";
import { DayChips } from "./DayChips";
import { hourLabel, normalizeReminders, SEND_HOURS } from "./reminderDefaults";
import { usePermission } from "../auth/permissions";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, ButtonLink, Card, Field, FormError, InlineAlert, Select, Switch, useToast } from "../../shared/ui";

const BEFORE_OPTIONS = [1, 2, 3, 5, 7, 10, 14, 30];
const AFTER_OPTIONS = [1, 3, 7, 14, 30, 60];
const EVERY_OPTIONS = [1, 2, 3, 5, 7, 10, 14];

function Section({ icon: Icon, title, children }) {
  return (
    <section className="flex flex-col gap-4 border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className="flex items-center gap-2 text-body-lg font-semibold text-ink">
        <Icon className="size-4 text-ink-3" aria-hidden />
        {title}
      </h3>
      {children}
    </section>
  );
}

/**
 * Settings section: automatic reminders. Owners and managers (reminders.manage) can edit; it
 * saves through /admin/reminders/settings, so a manager doesn't need the owner-only settings right.
 */
export default function ReminderSettings({ settings, readOnly }) {
  const canManage = usePermission("reminders.manage");
  const locked = readOnly && !canManage;
  const initial = useMemo(() => normalizeReminders(settings?.reminders), [settings?.reminders]);
  const [form, setForm] = useState(initial);
  useEffect(() => setForm(initial), [initial]);
  const update = useUpdateReminderSettings();
  const online = useOnlineStatus();
  const toast = useToast();

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const changed = Object.fromEntries(Object.entries(form).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(initial[k])));
  const dirty = Object.keys(changed).length > 0;
  const fields = update.error?.fields || {};
  const fieldError = (key) => fields[key] || Object.entries(fields).find(([k]) => k.startsWith(`${key}.`))?.[1];

  const submit = (e) => {
    e.preventDefault();
    update.mutate(changed, { onSuccess: () => toast.success("Reminder settings saved") });
  };

  return (
    <Card padding="lg">
      <form onSubmit={submit} noValidate>
        <FormError error={update.error} />
        {locked && (
          <InlineAlert tone="info" className="mb-4">
            Only the owner or a manager can change reminders.
          </InlineAlert>
        )}
        <fieldset disabled={locked} className="flex flex-col gap-5">
          <Switch
            checked={form.enabled}
            onChange={(enabled) => set({ enabled })}
            label="Send automatic reminders"
            description="Once a day, members get them in the app, by email, and as phone notifications if they turned those on. Nobody gets the same reminder twice."
          />
          {!form.enabled && (
            <InlineAlert tone="warning">Automatic reminders are off. Members won't be reminded about renewals or dues until you turn this back on.</InlineAlert>
          )}

          <Section icon={CalendarClock} title="Before the plan ends">
            <DayChips
              label="Remind members this many days before"
              hint="Only members who haven't renewed. Once a renewal is booked, reminders stop."
              value={form.expiryDaysBefore}
              onChange={(expiryDaysBefore) => set({ expiryDaysBefore })}
              options={BEFORE_OPTIONS}
              error={fieldError("expiryDaysBefore")}
              disabled={locked}
            />
            <Switch checked={form.onExpiryDay} onChange={(onExpiryDay) => set({ onExpiryDay })} label="On the last day" description="A final reminder on the day the plan ends." />
          </Section>

          <Section icon={HeartHandshake} title="After the plan ends">
            <DayChips
              label="Send a “we miss you” message after"
              hint="Only to members who still have no plan. Pick none to turn this off."
              value={form.afterExpiryDays}
              onChange={(afterExpiryDays) => set({ afterExpiryDays })}
              options={AFTER_OPTIONS}
              error={fieldError("afterExpiryDays")}
              disabled={locked}
            />
          </Section>

          <Section icon={IndianRupee} title="Dues">
            <Switch
              checked={form.paymentDue}
              onChange={(paymentDue) => set({ paymentDue })}
              label="Remind members who owe money"
              description="Starts the day after a due is added. Up to 6 reminders per due; after that, follow up in person."
            />
            <Field label="Remind every" error={fieldError("paymentDueEveryDays")} className="sm:max-w-xs">
              <Select value={form.paymentDueEveryDays} onChange={(e) => set({ paymentDueEveryDays: Number(e.target.value) })} disabled={locked || !form.paymentDue}>
                {[...new Set([...EVERY_OPTIONS, form.paymentDueEveryDays])]
                  .sort((a, b) => a - b)
                  .map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "Every day" : `${n} days`}
                    </option>
                  ))}
              </Select>
            </Field>
          </Section>

          <Section icon={Cake} title="Birthdays">
            <Switch
              checked={form.birthday}
              onChange={(birthday) => set({ birthday })}
              label="Send birthday wishes"
              description="To members who have had a plan and have a date of birth on file. Members can turn these off in their app."
            />
          </Section>

          <Section icon={Clock} title="Send time">
            <Field
              label="Send reminders at"
              error={fieldError("sendHour")}
              hint="Gym time. If the server was asleep at this hour, reminders go out as soon as it's back, until 9 pm."
              className="sm:max-w-xs"
            >
              <Select value={form.sendHour} onChange={(e) => set({ sendHour: Number(e.target.value) })}>
                {SEND_HOURS.map((h) => (
                  <option key={h} value={h}>
                    {hourLabel(h)}
                  </option>
                ))}
              </Select>
            </Field>
          </Section>
        </fieldset>

        <div className="mt-6 flex flex-col-reverse gap-2 border-t border-line pt-5 sm:flex-row sm:items-center">
          <ButtonLink to="/admin/announcements?tab=reminders" variant="ghost" className="sm:mr-auto">
            See who gets what today
            <ArrowRight className="size-4" aria-hidden />
          </ButtonLink>
          {!online && dirty && <p className="text-body-sm font-medium text-warn">You're offline. Save when the connection is back.</p>}
          {!locked && dirty && (
            <Button variant="ghost" onClick={() => setForm(initial)}>
              Undo changes
            </Button>
          )}
          {!locked && (
            <Button type="submit" variant="primary" loading={update.isPending} disabled={!dirty || !online}>
              Save reminder settings
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}
