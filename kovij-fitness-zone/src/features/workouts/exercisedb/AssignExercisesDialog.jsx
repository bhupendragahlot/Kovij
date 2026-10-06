import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { Check, Plus, Send, Trash2, UserRound, X } from "lucide-react";
import { useAssignExercises, staffExerciseDb } from "./api";
import { PrescriptionFields } from "./PrescriptionFields";
import { prescriptionForm, toPrescription } from "./prescription";
import { useWorkoutRoster } from "../api";
import { selectRole } from "../../auth/sessionSlice";
import { ExerciseDbBrowser } from "../../exercisedb/ExerciseDbBrowser";
import { ExerciseDbMedia } from "../../exercisedb/ExerciseDbMedia";
import { exerciseFacts } from "../../exercisedb/format";
import { useDebouncedValue } from "../../../shared/hooks/useDebouncedValue";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../../shared/hooks/useOnlineStatus";
import {
  Avatar,
  Button,
  Dialog,
  EmptyState,
  Field,
  FormError,
  IconButton,
  InlineAlert,
  Input,
  SearchInput,
  Select,
  Switch,
  useToast,
} from "../../../shared/ui";
import { formatPhone, gymDayKey } from "../../../shared/lib/format";

const MAX_EXERCISES = 20;
const REPEAT_OPTIONS = [1, 2, 3, 4, 6, 8, 12];

/** Pick one member. Trainers choose from their own members; managers from everyone. */
function MemberChooser({ value, onChange, error }) {
  const role = useSelector(selectRole);
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 250);
  const roster = useWorkoutRoster({ who: role === "trainer" ? "mine" : "all", q: term || undefined, page: 1, limit: 8 }, { enabled: !value });
  const items = roster.data?.items || [];

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-tile border border-line-strong bg-surface-2 p-2.5">
        <Avatar name={value.name} src={value.profilePhoto} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{value.name}</span>
          <span className="block truncate text-xs text-ink-3">{[value.memberCode, formatPhone(value.phone)].filter(Boolean).join(", ")}</span>
        </span>
        <IconButton icon={X} label="Choose another member" size="sm" onClick={() => onChange(null)} />
      </div>
    );
  }
  if (role === "trainer" && roster.data?.linked === false) {
    return (
      <InlineAlert tone="warning">
        Your login isn’t linked to a trainer profile yet, so you have no members. Ask the owner to link it under Trainers.
      </InlineAlert>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      <SearchInput
        value={q}
        onChange={setQ}
        label="Search members"
        placeholder={role === "trainer" ? "Search your members" : "Name, phone or member code"}
        onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
      />
      {error && <p className="text-body-sm font-medium text-bad">{error}</p>}
      <ul className="flex max-h-60 flex-col gap-0.5 overflow-y-auto rounded-tile border border-line p-1" aria-label="Members">
        {roster.isPending && <li className="px-3 py-2 text-sm text-ink-3">Loading members…</li>}
        {roster.isError && <li className="px-3 py-2 text-sm text-bad">{roster.error?.message || "Members didn't load."}</li>}
        {!roster.isPending && !roster.isError && items.length === 0 && (
          <li className="px-3 py-2 text-sm text-ink-3">
            {term ? `No member matches “${term}”.` : role === "trainer" ? "No members are assigned to you yet." : "No members yet."}
          </li>
        )}
        {items.map((m) => (
          <li key={m._id}>
            <button
              type="button"
              onClick={() => onChange(m)}
              className="flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2"
            >
              <Avatar name={m.name} src={m.profilePhoto} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{m.name}</span>
                <span className="block truncate text-xs text-ink-3">{[m.memberCode, formatPhone(m.phone)].filter(Boolean).join(", ")}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Server field errors for item `i` ("items.2.sets" → { sets }). */
const itemErrors = (fields, i) =>
  Object.fromEntries(
    Object.entries(fields || {})
      .filter(([k]) => k.startsWith(`items.${i}.`))
      .map(([k, v]) => [k.slice(`items.${i}.`.length), v])
  );

function checkItem(f) {
  const e = {};
  if (f.mode === "reps") {
    if (!f.sets) e.sets = "Add sets";
    if (!f.reps.trim()) e.reps = "Add reps, e.g. 8-12";
  } else if (!((Number(f.min) || 0) * 60 + (Number(f.sec) || 0))) {
    e.durationSec = "Add a time";
  }
  return e;
}

/**
 * Schedule ExerciseDB exercises for one member on a day, optionally every week. `member` fixes the
 * member (from their profile); `exercises` pre-adds exercises (from the ExerciseDB tab).
 */
export function AssignExercisesDialog({ open, onClose, member: fixedMember, exercises: initialExercises }) {
  const assign = useAssignExercises();
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [member, setMember] = useState(fixedMember || null);
  const [date, setDate] = useState(gymDayKey());
  const [repeatWeeks, setRepeatWeeks] = useState("1");
  const [items, setItems] = useState([]);
  const [notify, setNotify] = useState(true);
  const [clientErrors, setClientErrors] = useState({});

  useEffect(() => {
    if (!open) return;
    setMember(fixedMember || null);
    setDate(gymDayKey());
    setRepeatWeeks("1");
    setItems((initialExercises || []).map((exercise) => ({ exercise, form: prescriptionForm(exercise) })));
    setNotify(true);
    setClientErrors({});
    assign.reset();
    idempotency.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = gymDayKey();
  const serverFields = assign.error?.fields || {};
  const errors = { ...serverFields, ...clientErrors };
  const chosen = new Set(items.map((i) => i.exercise.id));

  const toggle = (exercise) =>
    setItems((cur) =>
      cur.some((i) => i.exercise.id === exercise.id)
        ? cur.filter((i) => i.exercise.id !== exercise.id)
        : cur.length >= MAX_EXERCISES
          ? cur
          : [...cur, { exercise, form: prescriptionForm(exercise) }]
    );
  const setForm = (id, form) => setItems((cur) => cur.map((i) => (i.exercise.id === id ? { ...i, form } : i)));

  const submit = (e) => {
    e.preventDefault();
    const next = {};
    if (!member) next.member = "Choose a member";
    if (!date) next.date = "Choose a day";
    else if (date < today) next.date = "Choose today or a later day";
    if (!items.length) next.items = "Add at least one exercise";
    items.forEach((it, i) => {
      for (const [k, v] of Object.entries(checkItem(it.form))) next[`items.${i}.${k}`] = v;
    });
    setClientErrors(next);
    if (Object.keys(next).length) return;
    const payload = {
      date,
      repeatWeeks: Number(repeatWeeks),
      notify,
      items: items.map((it) => ({ exerciseDbId: it.exercise.id, ...toPrescription(it.form) })),
    };
    assign.mutate(
      { memberId: member._id, payload, idempotencyKey: idempotency.keyFor({ memberId: member._id, ...payload }) },
      {
        onSuccess: (data) => {
          idempotency.reset();
          const n = items.length;
          toast.success(`${n} ${n === 1 ? "exercise" : "exercises"} scheduled for ${data.member.name}`, {
            description:
              Number(repeatWeeks) > 1
                ? `Every week for ${repeatWeeks} weeks (${data.assignments.length} in all).`
                : notify
                  ? "They'll see it in the app."
                  : undefined,
          });
          onClose();
        },
      }
    );
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={fixedMember ? `Assign exercises to ${fixedMember.name}` : "Assign exercises"}
      description="Pick exercises from ExerciseDB and say what to do. The member sees them on the day and ticks them off."
      placement="side"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="assign-exercises" variant="primary" icon={Send} loading={assign.isPending} disabled={!online}>
            {items.length > 1 ? `Assign ${items.length} exercises` : "Assign exercise"}
          </Button>
        </>
      }
    >
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. Reconnect to assign exercises.
        </InlineAlert>
      )}
      <FormError error={assign.error} />
      <form id="assign-exercises" onSubmit={submit} noValidate className="flex flex-col gap-6">
        {!fixedMember && (
          <fieldset>
            <legend className="mb-1.5 text-sm font-semibold text-ink">Member</legend>
            <MemberChooser value={member} onChange={setMember} error={errors.member} />
          </fieldset>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Day" error={errors.date} hint={date === today ? "Today" : undefined}>
            <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Repeat" error={errors.repeatWeeks}>
            <Select value={repeatWeeks} onChange={(e) => setRepeatWeeks(e.target.value)}>
              {REPEAT_OPTIONS.map((n) => (
                <option key={n} value={String(n)}>
                  {n === 1 ? "Just this day" : `Same day every week, ${n} weeks`}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <section aria-labelledby="assign-ex-chosen">
          <h3 id="assign-ex-chosen" className="mb-2 text-sm font-semibold text-ink">
            Exercises {items.length > 0 && <span className="font-normal text-ink-3">({items.length})</span>}
          </h3>
          {errors.items && <p className="mb-2 text-body-sm font-medium text-bad">{errors.items}</p>}
          {items.length === 0 ? (
            <EmptyState
              compact
              icon={UserRound}
              title="No exercises yet"
              body="Search ExerciseDB below and tap Add."
              className="rounded-tile border border-dashed border-line-strong"
            />
          ) : (
            <ol className="flex flex-col gap-3">
              {items.map((it, i) => (
                <li key={it.exercise.id} className="rounded-tile border border-line p-3">
                  <div className="mb-3 flex items-center gap-3">
                    <ExerciseDbMedia
                      src={it.exercise.thumbUrl || it.exercise.gifUrl}
                      className="size-12 shrink-0 rounded-[10px] border border-line"
                      iconClassName="size-5"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">
                        {i + 1}. {it.exercise.name}
                      </span>
                      <span className="block truncate text-body-sm text-ink-3">{exerciseFacts(it.exercise)}</span>
                    </span>
                    <IconButton icon={Trash2} label={`Remove ${it.exercise.name}`} size="sm" onClick={() => toggle(it.exercise)} />
                  </div>
                  <PrescriptionFields
                    value={it.form}
                    onChange={(form) => setForm(it.exercise.id, form)}
                    errors={itemErrors(errors, i)}
                    idPrefix={`ax-${it.exercise.id}`}
                  />
                </li>
              ))}
            </ol>
          )}
        </section>
      </form>

      {/* Outside the form: Enter in the search box searches instead of submitting. */}
      <div className="mt-6 flex flex-col gap-6">
        <section aria-labelledby="assign-ex-find" className="rounded-tile bg-surface-2/60 p-3">
          <h3 id="assign-ex-find" className="mb-3 text-sm font-semibold text-ink">
            Find exercises
          </h3>
          <ExerciseDbBrowser
            api={staffExerciseDb}
            layout="list"
            renderAction={(exercise) => {
              const on = chosen.has(exercise.id);
              return (
                <Button
                  size="sm"
                  variant={on ? "secondary" : "primary"}
                  icon={on ? Check : Plus}
                  aria-pressed={on}
                  disabled={!on && items.length >= MAX_EXERCISES}
                  onClick={() => toggle(exercise)}
                >
                  {on ? "Added" : "Add"}
                </Button>
              );
            }}
          />
        </section>

        <Switch
          label="Tell the member"
          description="Sends a notification in the app (and to their phone if they allow it)."
          checked={notify}
          onChange={setNotify}
        />
      </div>
    </Dialog>
  );
}
