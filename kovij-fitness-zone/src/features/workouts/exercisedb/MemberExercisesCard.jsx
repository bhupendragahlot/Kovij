import { useState } from "react";
import { CalendarPlus, ListChecks } from "lucide-react";
import { useMemberExerciseHistory, useMemberExerciseSchedule } from "./api";
import { AssignExercisesDialog } from "./AssignExercisesDialog";
import { AssignmentDetailDialog, AssignmentRow } from "./AssignmentRow";
import { useAssignmentActions } from "./useAssignmentActions";
import { EditExerciseAssignmentDialog } from "./EditExerciseAssignmentDialog";
import { dayLabel, groupByDay } from "../../exercisedb/format";
import { WeekProgress } from "../../exercisedb/WeekProgress";
import { Button, Card, CardHeader, EmptyState, ErrorState, Pagination, SegmentedControl, SkeletonList } from "../../../shared/ui";

const HISTORY_LIMIT = 10;

/** `dayLabels: false` for a section that is one day already (Today). */
function DayGroups({ title, items, todayKey, rowProps, dayLabels = true }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h4 className="text-xs font-bold uppercase tracking-wide text-ink-3">{title}</h4>
      {groupByDay(items).map((g) => (
        <div key={g.dayKey}>
          {dayLabels && <p className="mb-1 text-sm font-semibold text-ink-2">{dayLabel(g.dayKey, todayKey, { long: true })}</p>}
          <ul className="flex flex-col divide-y divide-line rounded-tile border border-line px-3 py-3">
            {g.items.map((a) => (
              <AssignmentRow key={a._id} a={a} todayKey={todayKey} {...rowProps} />
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}

function History({ memberId, status, todayKey, rowProps }) {
  const [page, setPage] = useState(1);
  const q = useMemberExerciseHistory(memberId, { status, page, limit: HISTORY_LIMIT });
  if (q.isPending) return <SkeletonList rows={3} />;
  if (q.isError && !q.data) return <ErrorState compact error={q.error} onRetry={() => q.refetch()} />;
  if (!q.data.items.length) {
    return (
      <EmptyState
        compact
        icon={ListChecks}
        title={status === "done" ? "Nothing done yet" : "Nothing missed"}
        body={status === "done" ? "Exercises the member ticks off show here." : "Past exercises that weren't ticked off show here."}
      />
    );
  }
  return (
    <>
      <ul className={`flex flex-col divide-y divide-line ${q.isFetching && q.isPlaceholderData ? "opacity-60" : ""}`}>
        {q.data.items.map((a) => (
          <AssignmentRow key={a._id} a={a} todayKey={todayKey} showDay {...rowProps} />
        ))}
      </ul>
      <Pagination className="mt-3" page={page} limit={HISTORY_LIMIT} total={q.data.total} onPage={setPage} />
    </>
  );
}

/** Member profile → Workouts: ExerciseDB exercises scheduled for this member, and how it's going. */
export function MemberExercisesCard({ member }) {
  const schedule = useMemberExerciseSchedule(member._id);
  const actions = useAssignmentActions();
  const [view, setView] = useState("schedule");
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const s = schedule.data;
  const canManage = Boolean(s?.canManage);
  const todayKey = s?.todayKey;
  const rowProps = { canManage, actions, onEdit: setEditing, onOpen: setOpen };
  const nothing = s && !s.overdue.length && !s.today.length && !s.thisWeek.length && !s.upcoming.length;

  return (
    <Card>
      <CardHeader
        title="Assigned exercises"
        description="From ExerciseDB, scheduled by day. The member ticks them off in the app."
        action={
          canManage && (
            <Button variant="secondary" size="sm" icon={CalendarPlus} onClick={() => setAssigning(true)}>
              Assign exercises
            </Button>
          )
        }
      />
      {schedule.isPending ? (
        <SkeletonList rows={3} />
      ) : schedule.isError && !s ? (
        <ErrorState compact error={schedule.error} onRetry={() => schedule.refetch()} />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              label="Show"
              size="sm"
              value={view}
              onChange={setView}
              options={[
                { value: "schedule", label: "Schedule" },
                { value: "done", label: s.counts.completed ? `Done ${s.counts.completed}` : "Done" },
                { value: "missed", label: "Missed" },
              ]}
            />
            {s.counts.week > 0 && <WeekProgress done={s.counts.weekDone} total={s.counts.week} className="min-w-48 flex-1 sm:max-w-64" />}
          </div>

          {view !== "schedule" ? (
            <History key={view} memberId={member._id} status={view} todayKey={todayKey} rowProps={rowProps} />
          ) : nothing ? (
            <EmptyState
              compact
              icon={ListChecks}
              title="Nothing scheduled"
              body={canManage ? "Pick exercises from ExerciseDB and choose the day." : "Only managers and this member's trainer can assign exercises."}
              action={
                canManage && (
                  <Button variant="primary" icon={CalendarPlus} onClick={() => setAssigning(true)}>
                    Assign exercises
                  </Button>
                )
              }
            />
          ) : (
            <>
              <DayGroups title="Still to do from earlier" items={s.overdue} todayKey={todayKey} rowProps={rowProps} />
              <DayGroups title="Today" items={s.today} todayKey={todayKey} rowProps={rowProps} dayLabels={false} />
              <DayGroups title="Later this week" items={s.thisWeek} todayKey={todayKey} rowProps={rowProps} />
              <DayGroups
                title={s.counts.upcoming > s.upcoming.length ? `Coming up (first ${s.upcoming.length} of ${s.counts.upcoming})` : "Coming up"}
                items={s.upcoming}
                todayKey={todayKey}
                rowProps={rowProps}
              />
            </>
          )}
        </div>
      )}
      <AssignExercisesDialog open={assigning} onClose={() => setAssigning(false)} member={member} />
      <EditExerciseAssignmentDialog open={Boolean(editing)} assignment={editing} onClose={() => setEditing(null)} />
      <AssignmentDetailDialog a={open} todayKey={todayKey} onClose={() => setOpen(null)} />
    </Card>
  );
}
