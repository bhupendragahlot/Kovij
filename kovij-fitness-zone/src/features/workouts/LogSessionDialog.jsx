import { useEffect, useState } from "react";
import { Minus, Plus, X } from "lucide-react";
import { useLogSession, useMemberWorkout } from "./api";
import { ExercisePicker } from "./ExercisePicker";
import { firstNumber, formatPrescription } from "./labels";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, ErrorState, Field, FormError, IconButton, InlineAlert, Input, Select, SkeletonList, Textarea, useToast } from "../../shared/ui";
import { gymDayKey } from "../../shared/lib/format";

const STAFF_DAYS_BACK = 60;
const MAX_SETS = 20;

const blankSet = (reps = "", weightKg = "") => ({ reps, weightKg, done: true });

/** Entries prefilled from a plan day: one row per prescribed set. */
function entriesFromDay(day) {
  return (day?.exercises || []).map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name,
    target: formatPrescription(e),
    sets: Array.from({ length: Math.min(e.sets || 1, MAX_SETS) }, () => blankSet(firstNumber(e.reps), e.weightKg ?? "")),
  }));
}

/** Entries from a saved session, so saving again edits it. */
function entriesFromLog(log, day) {
  const targets = new Map((day?.exercises || []).map((e) => [String(e.exerciseId), formatPrescription(e)]));
  return log.entries.map((e) => ({
    exerciseId: e.exerciseId,
    name: e.name,
    target: targets.get(String(e.exerciseId)) || "",
    sets: e.sets.map((s) => ({ reps: s.reps, weightKg: s.weightKg || "", done: s.done !== false })),
  }));
}

function toPayload({ date, dayIndex, entries, notes }) {
  return {
    date,
    dayIndex: Number(dayIndex),
    notes: notes.trim() || undefined,
    entries: entries
      .map((e) => ({
        exerciseId: e.exerciseId,
        sets: e.sets
          .filter((s) => s.reps !== "" && s.reps != null)
          .map((s) => ({ reps: Math.max(0, Math.round(Number(s.reps))), weightKg: s.weightKg === "" ? 0 : Number(s.weightKg), done: s.done })),
      }))
      .filter((e) => e.sets.length),
  };
}

function EntryCard({ entry, index, onChange, onRemove }) {
  const setAt = (k, patch) => onChange({ ...entry, sets: entry.sets.map((s, j) => (j === k ? { ...s, ...patch } : s)) });
  const last = entry.sets[entry.sets.length - 1];
  return (
    <li className="rounded-tile border border-line p-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">{entry.name}</p>
          {entry.target && <p className="text-body-sm text-ink-3">Plan: {entry.target}</p>}
        </div>
        <IconButton icon={X} label={`Remove ${entry.name}`} onClick={onRemove} />
      </div>
      <table className="mt-2 w-full text-sm">
        <caption className="sr-only">Sets for {entry.name}</caption>
        <thead>
          <tr className="text-left text-body-sm text-ink-3">
            <th scope="col" className="w-12 py-1 font-semibold">Set</th>
            <th scope="col" className="py-1 font-semibold">Reps</th>
            <th scope="col" className="py-1 font-semibold">Weight</th>
            <th scope="col" className="w-16 py-1 text-center font-semibold">Done</th>
          </tr>
        </thead>
        <tbody>
          {entry.sets.map((s, k) => (
            <tr key={k}>
              <th scope="row" className="py-1 text-left font-semibold text-ink-2">{k + 1}</th>
              <td className="py-1 pr-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  aria-label={`Reps, set ${k + 1} of ${entry.name}`}
                  value={s.reps}
                  onChange={(e) => setAt(k, { reps: e.target.value })}
                />
              </td>
              <td className="py-1 pr-2">
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0}
                  step="0.5"
                  suffix="kg"
                  placeholder="0"
                  aria-label={`Weight in kg, set ${k + 1} of ${entry.name}`}
                  value={s.weightKg}
                  onChange={(e) => setAt(k, { weightKg: e.target.value })}
                />
              </td>
              <td className="py-1 text-center">
                <label className="inline-grid size-11 cursor-pointer place-items-center rounded-control hover:bg-surface-2">
                  <input
                    type="checkbox"
                    className="size-5 accent-brand"
                    checked={s.done}
                    onChange={(e) => setAt(k, { done: e.target.checked })}
                    aria-label={`Set ${k + 1} of ${entry.name} done`}
                  />
                </label>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex gap-2">
        <Button
          variant="quiet"
          icon={Plus}
          disabled={entry.sets.length >= MAX_SETS}
          onClick={() => onChange({ ...entry, sets: [...entry.sets, blankSet(last?.reps ?? "", last?.weightKg ?? "")] })}
        >
          Add set
        </Button>
        {entry.sets.length > 1 && (
          <Button variant="ghost" icon={Minus} onClick={() => onChange({ ...entry, sets: entry.sets.slice(0, -1) })}>
            Remove last set
          </Button>
        )}
      </div>
      <span className="sr-only">Exercise {index + 1}</span>
    </li>
  );
}

/**
 * Log a session done at the gym for a member. Prefills the plan day's exercises and sets;
 * saving the same day and plan day again updates that session instead of adding another.
 */
export function LogSessionDialog({ open, onClose, member }) {
  const overview = useMemberWorkout(member?._id, { enabled: open });
  const logSession = useLogSession();
  const online = useOnlineStatus();
  const toast = useToast();
  const today = gymDayKey();
  const earliest = gymDayKey(new Date(Date.now() - STAFF_DAYS_BACK * 86_400_000));

  const [date, setDate] = useState(today);
  const [dayIndex, setDayIndex] = useState(0);
  const [entries, setEntries] = useState([]);
  const [notes, setNotes] = useState("");
  const [picking, setPicking] = useState(false);
  const [clientError, setClientError] = useState(null);
  const [ready, setReady] = useState(false);

  const current = overview.data?.current;
  const days = current?.days || [];

  // Prefill once the member's plan has loaded.
  useEffect(() => {
    if (!open) {
      setReady(false);
      return;
    }
    if (ready || !overview.data) return;
    const t = overview.data.today;
    const idx = t?.dayIndex ?? 0;
    const existing = t?.doneToday ? t.log : null;
    setDate(today);
    setDayIndex(idx);
    setEntries(existing ? entriesFromLog(existing, days[idx]) : entriesFromDay(days[idx]));
    setNotes(existing?.notes || "");
    setClientError(null);
    logSession.reset();
    setReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, overview.data, ready]);

  const changeDay = (idx) => {
    setDayIndex(idx);
    setEntries(entriesFromDay(days[idx]));
  };

  const addPicked = (picked) =>
    setEntries((prev) => [
      ...prev,
      ...picked
        .filter((x) => !prev.some((e) => e.exerciseId === x._id))
        .map((x) => ({ exerciseId: x._id, name: x.name, target: "", sets: [blankSet(), blankSet(), blankSet()].slice(0, x.category === "strength" ? 3 : 1) })),
    ]);

  const existingForChoice = overview.data?.recentLogs?.find((l) => l.dayKey === date && l.dayIndex === Number(dayIndex));
  const errors = logSession.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = toPayload({ date, dayIndex, entries, notes });
    const anyDone = payload.entries.some((x) => x.sets.some((s) => s.done && s.reps > 0));
    if (!anyDone) {
      setClientError("Enter reps for at least one finished set.");
      return;
    }
    setClientError(null);
    logSession.mutate(
      { memberId: member._id, payload },
      {
        onSuccess: (data) => {
          toast.success(data.created ? "Session saved" : "Session updated", {
            description: `${member.name}, ${data.log.dayName}: ${data.log.setsDone} ${data.log.setsDone === 1 ? "set" : "sets"}`,
          });
          onClose();
        },
      }
    );
  };

  return (
    <>
      <Dialog
        open={open && !picking}
        onClose={onClose}
        title={member ? `Log a session for ${member.name}` : "Log a session"}
        description="Record what they did on the floor. Their progress charts update from these sessions."
        placement="side"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" form="log-session" variant="primary" loading={logSession.isPending} disabled={!online || !ready}>
              Save session
            </Button>
          </>
        }
      >
        {overview.isPending ? (
          <SkeletonList rows={4} />
        ) : overview.isError ? (
          <ErrorState compact error={overview.error} onRetry={() => overview.refetch()} />
        ) : (
          <form id="log-session" onSubmit={submit} noValidate className="flex flex-col gap-4">
            {!online && <InlineAlert tone="offline">You're offline. Reconnect to save the session.</InlineAlert>}
            <FormError error={logSession.error} />
            {clientError && <InlineAlert tone="danger">{clientError}</InlineAlert>}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="Date" error={errors.date}>
                <Input type="date" value={date} min={earliest} max={today} onChange={(e) => setDate(e.target.value || today)} />
              </Field>
              {days.length > 0 ? (
                <Field label="Plan day" error={errors.dayIndex}>
                  <Select value={dayIndex} onChange={(e) => changeDay(Number(e.target.value))}>
                    {days.map((d, i) => (
                      <option key={i} value={i}>
                        {d.name}
                        {overview.data.today?.dayIndex === i && !overview.data.today?.doneToday ? " (next)" : ""}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : (
                <InlineAlert tone="info" className="self-end">
                  No workout plan. This is saved as a single workout.
                </InlineAlert>
              )}
            </div>
            {existingForChoice && <InlineAlert tone="info">A session for this day is already saved. Saving again replaces it.</InlineAlert>}

            {entries.length ? (
              <ol className="flex flex-col gap-2" aria-label="Exercises">
                {entries.map((entry, i) => (
                  <EntryCard
                    key={entry.exerciseId}
                    entry={entry}
                    index={i}
                    onChange={(next) => setEntries((prev) => prev.map((x, k) => (k === i ? next : x)))}
                    onRemove={() => setEntries((prev) => prev.filter((_, k) => k !== i))}
                  />
                ))}
              </ol>
            ) : (
              <p className="rounded-tile bg-surface-2 p-4 text-center text-sm text-ink-3">No exercises yet. Add what they did.</p>
            )}
            {errors.entries && <p className="text-body-sm font-medium text-bad">{errors.entries}</p>}
            <Button variant="secondary" icon={Plus} onClick={() => setPicking(true)} block>
              Add exercises
            </Button>
            <Field label="Notes" optional error={errors.notes}>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} maxLength={1000} placeholder="How it went, pain, what to change next time" />
            </Field>
          </form>
        )}
      </Dialog>
      <ExercisePicker open={picking} onClose={() => setPicking(false)} onPick={addPicked} title="Add exercises to this session" />
    </>
  );
}
