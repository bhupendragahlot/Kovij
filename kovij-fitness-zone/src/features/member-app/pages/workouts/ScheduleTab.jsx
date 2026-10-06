import { useState } from "react";
import { CalendarDays, Check, CheckCircle2, ListChecks } from "lucide-react";
import { useExerciseHistory, useExerciseSchedule, useLibraryExercise, useSetMyExerciseDone } from "../../queries";
import { ExerciseDbDialog } from "../../../exercisedb/ExerciseDbDialog";
import { WeekProgress } from "../../../exercisedb/WeekProgress";
import { dayLabel, groupByDay, prescription } from "../../../exercisedb/format";
import { Badge, Button, Card, EmptyState, ErrorState, Field, SegmentedControl, SkeletonList, Textarea, useToast } from "../../../../shared/ui";
import { cn } from "../../../../shared/lib/cn";
import { formatDateTime } from "../../../../shared/lib/format";

/** Members can tick off up to 7 days late (the server enforces the same window). */
const DAYS_BACK = 7;
const daysBetween = (a, b) => Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
const tickable = (a, todayKey) => a.status !== "cancelled" && a.dayKey <= todayKey && daysBetween(a.dayKey, todayKey) <= DAYS_BACK;

function DoneToggle({ a, todayKey, onToggle, pending }) {
  if (!tickable(a, todayKey)) return null;
  const done = a.status === "completed";
  return (
    <button
      type="button"
      aria-pressed={done}
      aria-label={done ? `${a.exercise.name} is done. Tap to undo` : `Mark ${a.exercise.name} done`}
      disabled={pending}
      onClick={() => onToggle(a, !done)}
      className={cn(
        "grid size-12 shrink-0 place-items-center rounded-full border-2 transition-colors disabled:opacity-60",
        done ? "border-good bg-good text-white" : "border-line-strong text-ink-3 hover:border-good hover:text-good"
      )}
    >
      <Check className="size-6" strokeWidth={3} aria-hidden />
    </button>
  );
}

function ExerciseItem({ a, todayKey, onOpen, onToggle, pending, showDay }) {
  const done = a.status === "completed";
  return (
    <li className="flex items-center gap-3 rounded-card border border-line bg-surface p-3">
      <button type="button" onClick={() => onOpen(a)} className="min-w-0 flex-1 text-left">
        <span className={cn("block font-semibold", done && "text-ink-2 line-through decoration-ink-3/60")}>{a.exercise.name}</span>
        <span className="block text-body-sm text-ink-3">{[showDay && dayLabel(a.dayKey, todayKey), prescription(a)].filter(Boolean).join(" · ")}</span>
        {a.notes && <span className="mt-0.5 block text-body-sm text-ink-2">Trainer: {a.notes}</span>}
        {done && a.completedAt && <span className="mt-0.5 block text-xs text-good">Done {formatDateTime(a.completedAt)}</span>}
      </button>
      <DoneToggle a={a} todayKey={todayKey} onToggle={onToggle} pending={pending} />
    </li>
  );
}

function DayList({ items, todayKey, itemProps, emptyTitle, emptyBody }) {
  if (!items.length) return <EmptyState compact icon={CalendarDays} title={emptyTitle} body={emptyBody} />;
  return (
    <div className="flex flex-col gap-4">
      {groupByDay(items).map((g) => (
        <section key={g.dayKey}>
          <h3 className="mb-2 text-sm font-bold text-ink-2">{dayLabel(g.dayKey, todayKey, { long: true })}</h3>
          <ul className="flex flex-col gap-2">
            {g.items.map((a) => (
              <ExerciseItem key={a._id} a={a} todayKey={todayKey} {...itemProps} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Completed({ todayKey, itemProps }) {
  const history = useExerciseHistory();
  if (history.isPending) return <SkeletonList rows={4} />;
  if (history.isError && !history.data) return <ErrorState compact error={history.error} onRetry={() => history.refetch()} />;
  const items = history.data.pages.flatMap((p) => p.items);
  if (!items.length)
    return <EmptyState compact icon={ListChecks} title="Nothing done yet" body="Exercises you tick off are kept here, so you can look back at them." />;
  return (
    <>
      <ul className="flex flex-col gap-2">
        {items.map((a) => (
          <ExerciseItem key={a._id} a={a} todayKey={todayKey} showDay {...itemProps} />
        ))}
      </ul>
      {history.hasNextPage && (
        <Button className="mt-3" variant="secondary" block loading={history.isFetchingNextPage} onClick={() => history.fetchNextPage()}>
          Show earlier
        </Button>
      )}
    </>
  );
}

/** The trainer's instructions, ExerciseDB's how-to, and the done button. */
function ExerciseSheet({ a, todayKey, onClose, onToggle, pending }) {
  const query = useLibraryExercise(a?.exercise.exerciseDbId);
  const [note, setNote] = useState("");
  const canTick = a && tickable(a, todayKey);
  const done = a?.status === "completed";
  return (
    <ExerciseDbDialog
      open={Boolean(a)}
      onClose={onClose}
      exercise={a?.exercise}
      query={query}
      footer={
        canTick ? (
          <Button
            block
            size="lg"
            variant={done ? "secondary" : "primary"}
            icon={done ? undefined : CheckCircle2}
            loading={pending}
            onClick={() => onToggle(a, !done, note.trim() || undefined, () => (setNote(""), onClose()))}
          >
            {done ? "Mark as not done" : "Mark as done"}
          </Button>
        ) : (
          <Button block variant="secondary" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      {a && (
        <div className="flex flex-col gap-3">
          <div className="rounded-tile bg-brand-soft p-3">
            <p className="text-body-sm font-semibold text-brand-ink">{dayLabel(a.dayKey, todayKey, { long: true })}</p>
            <p className="mt-0.5 text-title-lg font-bold text-ink">{prescription(a) || "As your trainer showed you"}</p>
            {a.notes && <p className="mt-1 text-sm text-ink-2">Trainer: {a.notes}</p>}
            {done && (
              <Badge className="mt-2" tone="good" icon={CheckCircle2}>
                Done{a.completedAt ? ` ${formatDateTime(a.completedAt)}` : ""}
              </Badge>
            )}
            {a.memberNote && <p className="mt-1 text-sm text-ink-2">Your note: “{a.memberNote}”</p>}
          </div>
          {canTick && !done && (
            <Field label="How did it go?" optional>
              <Textarea rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. Last set was hard" />
            </Field>
          )}
          {!canTick && a.dayKey > todayKey && <p className="text-sm text-ink-3">You can tick this off on the day.</p>}
        </div>
      )}
    </ExerciseDbDialog>
  );
}

/** Member app → Workouts → Schedule: what the trainer set for today, this week and later. */
export function ScheduleTab() {
  const schedule = useExerciseSchedule();
  const toggle = useSetMyExerciseDone();
  const toast = useToast();
  const [section, setSection] = useState("today");
  const [open, setOpen] = useState(null);

  if (schedule.isPending) {
    return (
      <Card>
        <SkeletonList rows={4} />
      </Card>
    );
  }
  if (schedule.isError && !schedule.data) {
    return (
      <Card>
        <ErrorState error={schedule.error} onRetry={() => schedule.refetch()} />
      </Card>
    );
  }

  const s = schedule.data;
  const todayKey = s.todayKey;
  const onToggle = (a, done, memberNote, after) =>
    toggle.mutate(
      { id: a._id, done, memberNote },
      {
        onSuccess: () => {
          if (done) toast.success(`${a.exercise.name} done. Nice work!`);
          after?.();
        },
        onError: (e) => toast.error(done ? "Couldn't mark it done" : "Couldn't undo it", { description: e.message }),
      }
    );
  // Keep the open sheet in step with the list (e.g. after ticking it off).
  const current = open && [...s.today, ...s.overdue, ...s.thisWeek, ...s.upcoming].find((a) => a._id === open._id);
  const itemProps = { onOpen: setOpen, onToggle, pending: toggle.isPending };
  const todayLeft = s.today.filter((a) => a.status !== "completed").length;
  const next = s.thisWeek[0] || s.upcoming[0];

  return (
    <div className="flex flex-col gap-4">
      {s.counts.week > 0 && (
        <Card>
          <WeekProgress done={s.counts.weekDone} total={s.counts.week} />
        </Card>
      )}
      <SegmentedControl
        label="Show"
        block
        value={section}
        onChange={setSection}
        options={[
          { value: "today", label: s.today.length ? `Today ${s.today.length}` : "Today" },
          { value: "week", label: s.thisWeek.length ? `Week ${s.thisWeek.length}` : "Week" },
          { value: "upcoming", label: s.counts.upcoming ? `Later ${s.counts.upcoming}` : "Later" },
          { value: "done", label: "Done" },
        ]}
      />

      {section === "today" && (
        <div className="flex flex-col gap-4">
          {s.overdue.length > 0 && (
            <section>
              <h3 className="mb-2 text-sm font-bold text-warn">Still to do from earlier</h3>
              <ul className="flex flex-col gap-2">
                {s.overdue.map((a) => (
                  <ExerciseItem key={a._id} a={a} todayKey={todayKey} showDay {...itemProps} />
                ))}
              </ul>
            </section>
          )}
          {s.today.length ? (
            <section>
              <h3 className="mb-2 text-sm font-bold text-ink-2">{todayLeft ? `Today: ${todayLeft} to go` : "Today: all done"}</h3>
              <ul className="flex flex-col gap-2">
                {s.today.map((a) => (
                  <ExerciseItem key={a._id} a={a} todayKey={todayKey} {...itemProps} />
                ))}
              </ul>
            </section>
          ) : (
            !s.overdue.length && (
              <Card>
                <EmptyState
                  compact
                  icon={CalendarDays}
                  title="Nothing scheduled for today"
                  body={
                    next
                      ? `Next: ${dayLabel(next.dayKey, todayKey, { long: true })}, ${next.exercise.name}.`
                      : "When your trainer schedules exercises for you, they show here."
                  }
                />
              </Card>
            )
          )}
        </div>
      )}
      {section === "week" && (
        <DayList
          items={s.thisWeek}
          todayKey={todayKey}
          itemProps={itemProps}
          emptyTitle="Nothing more this week"
          emptyBody="Exercises for the rest of this week show here."
        />
      )}
      {section === "upcoming" && (
        <DayList
          items={s.upcoming}
          todayKey={todayKey}
          itemProps={itemProps}
          emptyTitle="Nothing scheduled after this week"
          emptyBody="Your trainer's plans for the coming weeks show here."
        />
      )}
      {section === "done" && <Completed todayKey={todayKey} itemProps={itemProps} />}

      <ExerciseSheet a={current || open} todayKey={todayKey} onClose={() => setOpen(null)} onToggle={onToggle} pending={toggle.isPending} />
    </div>
  );
}
