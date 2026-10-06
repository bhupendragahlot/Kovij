import { useState } from "react";
import { CalendarCheck, ClipboardList, Dumbbell, Ellipsis, History, Pencil, Plus, Replace, Square, Trash2, TrendingUp, UserRound } from "lucide-react";
import {
  useAssignTrainerMembers,
  useDeleteLog,
  useEndAssignment,
  useExerciseProgress,
  useMemberLogs,
  useMemberProgress,
  useMemberWorkout,
  useTrainers,
  useUnassignTrainerMember,
} from "./api";
import { AssignPlanDialog } from "./AssignPlanDialog";
import { EditMemberPlanDialog } from "./EditMemberPlanDialog";
import { ExerciseProgressChart } from "./ExerciseProgressChart";
import { LogSessionDialog } from "./LogSessionDialog";
import { MemberExercisesCard } from "./exercisedb/MemberExercisesCard";
import { LEVEL_LABEL, PLAN_GOAL_LABEL, dayKeyDate, formatKg, formatPrescription, formatRest, perWeek } from "./labels";
import { usePermission } from "../auth/permissions";
import {
  Avatar,
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  IconButton,
  InlineAlert,
  Menu,
  Pagination,
  SegmentedControl,
  Select,
  Skeleton,
  SkeletonList,
  Tile,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatDate, formatRelativeDay, formatShortDate } from "../../shared/lib/format";

const LOG_LIMIT = 10;

/** Who coaches this member; managers can change it here. */
function TrainerCard({ member }) {
  const trainers = useTrainers();
  const canAssign = usePermission("trainers.manage");
  const assign = useAssignTrainerMembers();
  const unassign = useUnassignTrainerMember();
  const toast = useToast();
  const currentId = member.assignedTrainerId ? String(member.assignedTrainerId) : "";
  const trainer = trainers.data?.find((t) => t._id === currentId);
  const busy = assign.isPending || unassign.isPending;

  const change = (value) => {
    if (value === currentId) return;
    const onError = (e) => toast.error("Couldn't change the trainer", { description: e.message });
    if (!value) {
      unassign.mutate({ trainerId: currentId, memberId: member._id }, { onSuccess: () => toast.success("Trainer removed"), onError });
      return;
    }
    const next = trainers.data.find((t) => t._id === value);
    assign.mutate({ trainerId: value, memberIds: [member._id] }, { onSuccess: () => toast.success(`${next.name} is now ${member.name}'s trainer`), onError });
  };

  return (
    <Card>
      <CardHeader title="Trainer" />
      {trainers.isPending ? (
        <Skeleton className="h-10 w-48" />
      ) : trainers.isError ? (
        <ErrorState compact error={trainers.error} onRetry={() => trainers.refetch()} />
      ) : (
        <div className="flex flex-col gap-3">
          {trainer ? (
            <div className="flex items-center gap-3">
              <Avatar name={trainer.name} src={trainer.image} />
              <div className="min-w-0">
                <p className="truncate font-semibold">{trainer.name}</p>
                <p className="truncate text-body-sm text-ink-3">{trainer.scheduleText || trainer.role}</p>
              </div>
            </div>
          ) : (
            <p className="flex items-center gap-2 text-sm text-ink-3">
              <UserRound className="size-4" aria-hidden />
              No trainer assigned
            </p>
          )}
          {canAssign && (
            <Field label={trainer ? "Change trainer" : "Assign a trainer"}>
              <Select value={currentId} onChange={(e) => change(e.target.value)} disabled={busy}>
                <option value="">No trainer</option>
                {trainers.data
                  .filter((t) => t.isActive !== false || t._id === currentId)
                  .map((t) => (
                    <option key={t._id} value={t._id}>
                      {t.name}
                    </option>
                  ))}
              </Select>
            </Field>
          )}
        </div>
      )}
    </Card>
  );
}

function TodayLine({ today }) {
  if (!today) return null;
  if (today.startsOn) return <p className="text-sm font-semibold text-info">Starts {formatDate(dayKeyDate(today.startsOn))}</p>;
  if (today.doneToday)
    return (
      <p className="flex items-center gap-1.5 text-sm font-semibold text-good">
        <CalendarCheck className="size-4" aria-hidden />
        Trained today: {today.day?.name}
      </p>
    );
  return <p className="text-sm font-semibold text-ink">Next: {today.day?.name}</p>;
}

function PlanDays({ days, highlight }) {
  return (
    <div className="flex flex-col gap-2">
      {days.map((d, i) => (
        <details key={i} className="group rounded-tile border border-line" open={i === highlight}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 [&::-webkit-details-marker]:hidden">
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{d.name}</span>
              <span className="block text-body-sm text-ink-3">
                {d.exercises.length} {d.exercises.length === 1 ? "exercise" : "exercises"}
              </span>
            </span>
            {i === highlight && (
              <Badge size="sm" tone="brand">
                Next
              </Badge>
            )}
          </summary>
          <ol className="divide-y divide-line border-t border-line">
            {d.exercises.map((e, j) => (
              <li key={j} className="px-3.5 py-2.5">
                <p className="text-sm font-semibold">{e.name}</p>
                <p className="text-body-sm text-ink-2">
                  {formatPrescription(e)}, rest {formatRest(e.restSec).toLowerCase()}
                </p>
                {e.notes && <p className="mt-0.5 text-body-sm text-ink-3">{e.notes}</p>}
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

function Sessions({ memberId, memberName }) {
  const [page, setPage] = useState(1);
  const logs = useMemberLogs(memberId, { page, limit: LOG_LIMIT });
  const remove = useDeleteLog();
  const confirm = useConfirm();
  const toast = useToast();

  const onDelete = async (log) => {
    const ok = await confirm({
      title: "Delete this session?",
      body: `${log.dayName} on ${formatDate(dayKeyDate(log.dayKey))} will be removed from ${memberName}'s history and progress.`,
      confirmLabel: "Delete session",
      tone: "danger",
    });
    if (!ok) return;
    remove.mutate(log._id, { onSuccess: () => toast.success("Session deleted"), onError: (e) => toast.error("Couldn't delete the session", { description: e.message }) });
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="px-4 pt-4 md:px-5">
        <CardHeader title="Workout history" description="Sessions logged by the member or by staff." />
      </div>
      {logs.isPending ? (
        <SkeletonList rows={3} className="px-4 pb-4" />
      ) : logs.isError && !logs.data ? (
        <ErrorState compact error={logs.error} onRetry={() => logs.refetch()} />
      ) : !logs.data.items.length ? (
        <EmptyState compact icon={History} title="No sessions yet" body="Sessions appear here once the member logs them in the app or you log one for them." />
      ) : (
        <>
          <ul className="divide-y divide-line">
            {logs.data.items.map((l) => (
              <li key={l._id} className="flex items-start gap-3 px-4 py-3 md:px-5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">
                    {l.dayName} <span className="font-normal text-ink-3">· {formatDate(dayKeyDate(l.dayKey))}</span>
                  </p>
                  <p className="text-body-sm text-ink-2">
                    {l.setsDone} {l.setsDone === 1 ? "set" : "sets"}
                    {l.volumeKg ? `, ${formatKg(l.volumeKg)} lifted` : ""}, {l.entries.map((e) => e.name).join(", ")}
                  </p>
                  <p className="text-body-sm text-ink-3">
                    {l.loggedBy === "member" ? "Logged in the app" : `Logged by ${l.loggedByName || "staff"}`}
                    {l.notes ? `. “${l.notes}”` : ""}
                  </p>
                </div>
                <Menu
                  label={`Actions for the session on ${formatShortDate(dayKeyDate(l.dayKey))}`}
                  trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for the session on ${formatShortDate(dayKeyDate(l.dayKey))}`} size="md" />}
                  items={[{ label: "Delete session", icon: Trash2, tone: "danger", onSelect: () => onDelete(l) }]}
                />
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={LOG_LIMIT} total={logs.data.total} onPage={setPage} />
        </>
      )}
    </Card>
  );
}

function Progress({ memberId }) {
  const overview = useMemberProgress(memberId);
  const [exerciseId, setExerciseId] = useState("");
  const [metric, setMetric] = useState("e1rm");
  const exercises = overview.data?.exercises || [];
  const selected = exerciseId || exercises[0]?.exerciseId || "";
  const detail = useExerciseProgress(memberId, selected);
  const row = exercises.find((e) => e.exerciseId === selected);
  const unloaded = row && !row.best.weightKg;
  const effectiveMetric = unloaded && metric === "e1rm" ? "reps" : metric;

  return (
    <Card>
      <CardHeader title="Progress" description="Best set per session for each exercise." />
      {overview.isPending ? (
        <SkeletonList rows={2} />
      ) : overview.isError ? (
        <ErrorState compact error={overview.error} onRetry={() => overview.refetch()} />
      ) : !exercises.length ? (
        <EmptyState compact icon={TrendingUp} title="Nothing to chart yet" body="Log a few sessions with reps and weights to see strength trends here." />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Exercise">
              <Select value={selected} onChange={(e) => setExerciseId(e.target.value)}>
                {exercises.map((e) => (
                  <option key={e.exerciseId} value={e.exerciseId}>
                    {e.name} ({e.sessions})
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Show">
              <SegmentedControl
                label="Measure"
                block
                value={effectiveMetric}
                onChange={setMetric}
                options={unloaded ? [{ value: "reps", label: "Reps" }] : [{ value: "e1rm", label: "Strength" }, { value: "volumeKg", label: "Volume" }]}
              />
            </Field>
          </div>
          {row && (
            <div className="grid grid-cols-2 gap-3">
              <Tile>
                <p className="text-body-sm font-semibold text-ink-3">Best</p>
                <p className="mt-1 font-bold">{row.best.weightKg ? `${row.best.reps} × ${formatKg(row.best.weightKg)}` : `${row.best.reps} reps`}</p>
                <p className="text-body-sm text-ink-3">{formatShortDate(dayKeyDate(row.best.dayKey))}</p>
              </Tile>
              <Tile>
                <p className="text-body-sm font-semibold text-ink-3">Last time</p>
                <p className="mt-1 font-bold">{row.last.weightKg ? `${row.last.reps} × ${formatKg(row.last.weightKg)}` : `${row.last.reps} reps`}</p>
                <p className="text-body-sm text-ink-3">{formatRelativeDay(dayKeyDate(row.lastDayKey))}</p>
              </Tile>
            </div>
          )}
          {detail.isPending ? (
            <Skeleton className="h-52 w-full" />
          ) : detail.isError && !detail.data ? (
            <ErrorState compact error={detail.error} onRetry={() => detail.refetch()} />
          ) : detail.data.points.length < 2 ? (
            <p className="rounded-tile bg-surface-2 p-4 text-center text-sm text-ink-3">One session so far. The trend appears after the next one.</p>
          ) : (
            <ExerciseProgressChart points={detail.data.points} metric={effectiveMetric} name={detail.data.exercise.name} />
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Member profile tab "Workouts": trainer, current plan, logging, history and progress.
 * Receives { member } from MemberProfilePage and fetches the rest itself.
 */
export default function MemberWorkoutTab({ member }) {
  const canManage = usePermission("workouts.manage");
  const overview = useMemberWorkout(member._id, { enabled: canManage });
  const end = useEndAssignment();
  const confirm = useConfirm();
  const toast = useToast();
  const [dialog, setDialog] = useState(null); // "assign" | "log" | "edit"

  if (!canManage) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TrainerCard member={member} />
        <Card>
          <CardHeader title="Workout plan" />
          <p className="text-sm text-ink-3">Trainers and managers give and update workout plans. Ask {member.name}'s trainer about their programme.</p>
        </Card>
      </div>
    );
  }

  if (overview.isPending) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <SkeletonList rows={4} />
        </Card>
        <Card>
          <SkeletonList rows={2} />
        </Card>
      </div>
    );
  }
  if (overview.isError) {
    return (
      <Card>
        <ErrorState error={overview.error} onRetry={() => overview.refetch()} />
      </Card>
    );
  }

  const { current, today, history, stats } = overview.data;

  const onEnd = async () => {
    const ok = await confirm({
      title: `End ${current.name}?`,
      body: `${member.name} will have no workout plan until you give a new one. Their sessions stay in history.`,
      confirmLabel: "End plan",
      tone: "danger",
    });
    if (!ok) return;
    end.mutate({ id: current._id }, { onSuccess: () => toast.success("Plan ended"), onError: (e) => toast.error("Couldn't end the plan", { description: e.message }) });
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div className="flex flex-col gap-4 lg:col-span-2">
        <Card>
          {current ? (
            <>
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-body-sm font-semibold text-ink-3">Workout plan</p>
                  <h2 className="text-title-lg font-bold">{current.name}</h2>
                  <p className="text-body-sm text-ink-3">
                    {[PLAN_GOAL_LABEL[current.goal], LEVEL_LABEL[current.level], perWeek(current.daysPerWeek)].filter(Boolean).join(", ")}. Since{" "}
                    {formatDate(dayKeyDate(current.startDay))}.
                  </p>
                  <div className="mt-2">
                    <TodayLine today={today} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="primary" icon={Plus} onClick={() => setDialog("log")}>
                    Log a session
                  </Button>
                  <Button variant="secondary" icon={Pencil} onClick={() => setDialog("edit")}>
                    Edit plan
                  </Button>
                  <Menu
                    label="More plan actions"
                    trigger={(props) => <IconButton {...props} icon={Ellipsis} label="More plan actions" variant="secondary" />}
                    items={[
                      { label: "Change plan", icon: Replace, onSelect: () => setDialog("assign") },
                      { type: "separator" },
                      { label: "End plan", icon: Square, tone: "danger", onSelect: onEnd },
                    ]}
                  />
                </div>
              </div>
              {current.notes && <InlineAlert tone="info" className="mb-4">{current.notes}</InlineAlert>}
              <PlanDays days={current.days} highlight={today && !today.startsOn ? today.dayIndex : -1} />
            </>
          ) : (
            <EmptyState
              icon={Dumbbell}
              title="No workout plan yet"
              body={`Give ${member.name} a plan from your templates. You can adjust it just for them afterwards.`}
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="primary" icon={ClipboardList} onClick={() => setDialog("assign")}>
                    Give a plan
                  </Button>
                  <Button variant="secondary" icon={Plus} onClick={() => setDialog("log")}>
                    Log a session
                  </Button>
                </div>
              }
            />
          )}
        </Card>
        <MemberExercisesCard member={member} />
        <Progress memberId={member._id} />
        <Sessions memberId={member._id} memberName={member.name} />
      </div>

      <div className="flex flex-col gap-4">
        <TrainerCard member={member} />
        <Card>
          <CardHeader title="Last 30 days" />
          <div className="grid grid-cols-2 gap-3">
            <Tile>
              <p className="text-body-sm font-semibold text-ink-3">Sessions logged</p>
              <p className="mt-1 text-title-lg font-bold">{stats.sessions30}</p>
            </Tile>
            <Tile>
              <p className="text-body-sm font-semibold text-ink-3">All time</p>
              <p className="mt-1 text-title-lg font-bold">{stats.totalSessions}</p>
            </Tile>
          </div>
        </Card>
        {history.length > 0 && (
          <Card>
            <CardHeader title="Earlier plans" />
            <ol className="flex flex-col gap-3">
              {history.map((h) => (
                <li key={h._id}>
                  <p className="text-sm font-semibold">{h.name}</p>
                  <p className="text-body-sm text-ink-3">
                    {formatShortDate(dayKeyDate(h.startDay))} to {h.endDay ? formatShortDate(dayKeyDate(h.endDay)) : "—"}
                    {h.endReason === "replaced" ? ", replaced" : h.endNote ? `, ${h.endNote}` : ""}
                  </p>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </div>

      <AssignPlanDialog
        open={dialog === "assign"}
        onClose={() => setDialog(null)}
        member={{ _id: member._id, name: member.name, profilePhoto: member.profilePhoto }}
        currentPlanName={current?.name}
      />
      <LogSessionDialog open={dialog === "log"} onClose={() => setDialog(null)} member={member} />
      {current && <EditMemberPlanDialog open={dialog === "edit"} onClose={() => setDialog(null)} assignment={current} memberName={member.name} />}
    </div>
  );
}
