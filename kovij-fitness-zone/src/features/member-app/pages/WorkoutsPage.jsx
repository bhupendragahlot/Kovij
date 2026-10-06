import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, ChevronDown, Dumbbell, PlayCircle } from "lucide-react";
import { useExerciseSchedule, useLogWorkout, useWorkout, useWorkoutLogs } from "../queries";
import { ExploreTab } from "./workouts/ExploreTab";
import { ScheduleTab } from "./workouts/ScheduleTab";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { Badge, Button, Card, CardHeader, EmptyState, ErrorState, FormError, Input, PageHeader, SkeletonList, TabPanel, Tabs, useToast } from "../../../shared/ui";
import { formatDate, pluralize } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

const GOAL = { muscle_gain: "Build muscle", fat_loss: "Lose fat", strength: "Get stronger", general_fitness: "General fitness", endurance: "Endurance" };
const firstNumber = (reps) => Number(String(reps || "").match(/\d+/)?.[0] || 0);

const TABS = [
  { value: "schedule", label: "Schedule" },
  { value: "plan", label: "My plan" },
  { value: "explore", label: "Explore" },
];

/**
 * Workouts: exercises the trainer scheduled (Schedule), the rotating workout plan (My plan), and
 * the ExerciseDB catalogue (Explore). Opens on Schedule when anything is scheduled, else on the plan.
 */
export default function WorkoutsPage() {
  const [params, setParams] = useSearchParams();
  const w = useWorkout();
  const schedule = useExerciseSchedule();
  const asked = params.get("tab");
  const s = schedule.data;
  const scheduled = Boolean(s && (s.today.length || s.overdue.length || s.thisWeek.length || s.upcoming.length));
  const tab = TABS.some((t) => t.value === asked) ? asked : w.isPending || schedule.isPending ? null : scheduled || !w.data?.plan ? "schedule" : "plan";

  return (
    <>
      <PageHeader title="Workouts" />
      {!tab ? (
        <Card>
          <SkeletonList rows={5} />
        </Card>
      ) : (
        <>
          <Tabs label="Workouts" value={tab} onChange={(t) => setParams({ tab: t }, { replace: true })} tabs={TABS} className="mb-4" />
          <TabPanel value={tab}>{tab === "schedule" ? <ScheduleTab /> : tab === "plan" ? <PlanTab w={w} /> : <ExploreTab />}</TabPanel>
        </>
      )}
    </>
  );
}

/** The rotating workout plan the trainer gave (unchanged from before the tabs). */
function PlanTab({ w }) {
  const plan = w.data?.plan;
  const today = w.data?.today;
  const [dayIndex, setDayIndex] = useState(null);
  const shown = dayIndex ?? today?.dayIndex ?? 0;

  if (w.isPending) return <Card><SkeletonList rows={5} /></Card>;
  if (w.isError) return <Card><ErrorState error={w.error} onRetry={() => w.refetch()} /></Card>;
  if (!plan) {
    return (
      <Card>
        <EmptyState
          icon={Dumbbell}
          title="No workout plan yet"
          body="Your trainer adds a plan for you here. Ask at the desk or send the gym a message."
          action={<Link to="/member/support/new" className="inline-flex h-11 items-center rounded-full bg-brand px-5 font-bold text-on-brand">Ask for a plan</Link>}
        />
      </Card>
    );
  }

  const day = plan.days[shown];
  return (
    <>
      <div className="mb-4">
        <h2 className="text-lg font-bold">{plan.name}</h2>
        <p className="text-[13px] text-ink-3">{[GOAL[plan.goal], plan.level && `${plan.level[0].toUpperCase()}${plan.level.slice(1)}`, plan.daysPerWeek && `${plan.daysPerWeek} days a week`].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="flex flex-col gap-4">
        {plan.days.length > 1 && (
          <Tabs
            label="Workout days"
            value={String(shown)}
            onChange={(v) => setDayIndex(Number(v))}
            tabs={plan.days.map((d, i) => ({ value: String(i), label: i === today?.dayIndex ? `${d.name} (today)` : d.name }))}
          />
        )}
        <Card>
          <CardHeader
            title={day.name}
            description={pluralize(day.exercises.length, "exercise")}
            action={shown === today?.dayIndex && today?.doneToday ? <Badge tone="good" icon={CheckCircle2}>Done today</Badge> : null}
          />
          <ol className="flex flex-col divide-y divide-line">
            {day.exercises.map((e, i) => (
              <ExerciseRow key={e._id || i} exercise={e} n={i + 1} />
            ))}
          </ol>
        </Card>
        <LogSession day={day} dayIndex={shown} done={shown === today?.dayIndex && today?.doneToday} />
        <RecentSessions />
      </div>
    </>
  );
}

function ExerciseRow({ exercise: e, n }) {
  const [open, setOpen] = useState(false);
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 text-left">
        <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-[13px] font-bold">{n}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold">{e.name}</span>
          <span className="block text-[13px] text-ink-3">
            {e.sets} × {e.reps}
            {e.weightKg ? ` · ${e.weightKg} kg` : ""}
            {e.restSec ? ` · rest ${e.restSec >= 60 ? `${Math.round(e.restSec / 60 * 10) / 10} min` : `${e.restSec} s`}` : ""}
          </span>
        </span>
        <ChevronDown className={cn("size-5 text-ink-3 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open && (
        <div className="mt-2 pl-11 text-sm text-ink-2">
          {e.instructions && <p>{e.instructions}</p>}
          {e.notes && <p className="mt-1 font-medium">Trainer’s note: {e.notes}</p>}
          {e.videoUrl && (
            <a href={e.videoUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
              <PlayCircle className="size-4" aria-hidden />
              Watch how
            </a>
          )}
        </div>
      )}
    </li>
  );
}

/** Quick log of what was actually done: sets pre-filled from the plan, tick what you finished. */
function LogSession({ day, dayIndex, done }) {
  const initial = useMemo(
    () => day.exercises.map((e) => ({ exerciseId: e.exerciseId, name: e.name, sets: Array.from({ length: e.sets || 1 }, () => ({ reps: firstNumber(e.reps), weightKg: e.weightKg || "", done: false })) })),
    [day]
  );
  const [entries, setEntries] = useState(initial);
  const [open, setOpen] = useState(false);
  const log = useLogWorkout();
  const toast = useToast();
  const { keyFor, reset } = useIdempotencyKey();

  const setSet = (ei, si, patch) => setEntries((all) => all.map((e, i) => (i === ei ? { ...e, sets: e.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)) } : e)));

  const submit = (ev) => {
    ev.preventDefault();
    const payload = {
      dayIndex,
      entries: entries.map((e) => ({ exerciseId: e.exerciseId, sets: e.sets.map((s) => ({ reps: Number(s.reps) || 0, weightKg: s.weightKg === "" ? 0 : Number(s.weightKg), done: s.done })) })),
    };
    log.mutate(
      { payload, idempotencyKey: keyFor(payload) },
      { onSuccess: (data) => (reset(), setOpen(false), toast.success(data.created ? "Workout logged. Nice work!" : "Workout updated")) }
    );
  };

  if (!open) {
    return (
      <Button variant={done ? "secondary" : "primary"} size="lg" block onClick={() => (setEntries(initial), setOpen(true))}>
        {done ? "Update today’s log" : "Log this workout"}
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader title="Log this workout" description="Tick each set you finished. Change reps or weight if they were different." />
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <FormError error={log.error} />
        {entries.map((e, ei) => (
          <fieldset key={e.exerciseId}>
            <legend className="mb-2 font-semibold">{e.name}</legend>
            <div className="flex flex-col gap-2">
              {e.sets.map((s, si) => (
                <div key={si} className="grid grid-cols-[2.5rem_1fr_1fr_auto] items-center gap-2">
                  <span className="text-[13px] font-semibold text-ink-3">Set {si + 1}</span>
                  <Input type="number" inputMode="numeric" min="0" aria-label={`${e.name} set ${si + 1} reps`} suffix="reps" value={s.reps} onChange={(ev) => setSet(ei, si, { reps: ev.target.value })} />
                  <Input type="number" inputMode="decimal" min="0" step="0.5" aria-label={`${e.name} set ${si + 1} weight`} suffix="kg" value={s.weightKg} onChange={(ev) => setSet(ei, si, { weightKg: ev.target.value })} />
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={s.done}
                    aria-label={`${e.name} set ${si + 1} done`}
                    onClick={() => setSet(ei, si, { done: !s.done })}
                    className={cn("grid size-11 place-items-center rounded-full border-2", s.done ? "border-good bg-good text-white" : "border-line-strong text-transparent")}
                  >
                    <CheckCircle2 className="size-5" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={log.isPending}>
            Save workout
          </Button>
        </div>
      </form>
    </Card>
  );
}

function RecentSessions() {
  const logs = useWorkoutLogs();
  const items = logs.data?.items || [];
  if (logs.isPending || !items.length) return null;
  return (
    <Card>
      <CardHeader title="Recent sessions" />
      <ul className="flex flex-col divide-y divide-line">
        {items.slice(0, 8).map((l) => (
          <li key={l._id || l.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
            <span>
              <span className="block font-semibold">{l.dayName || `Day ${(l.dayIndex ?? 0) + 1}`}</span>
              <span className="block text-[13px] text-ink-3">{formatDate(l.dayKey ? `${l.dayKey}T12:00:00+05:30` : l.performedAt)}</span>
            </span>
            <span className="tabular text-[13px] text-ink-3">
              {l.setsDone != null ? pluralize(l.setsDone, "set") : ""}
              {l.volumeKg ? ` · ${Math.round(l.volumeKg).toLocaleString("en-IN")} kg lifted` : ""}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
