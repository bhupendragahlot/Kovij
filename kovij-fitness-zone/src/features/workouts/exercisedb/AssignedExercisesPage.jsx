import { useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { CalendarPlus, CheckCircle2, ListChecks, Percent, TriangleAlert, Users } from "lucide-react";
import { useExerciseAssignments } from "./api";
import { AssignExercisesDialog } from "./AssignExercisesDialog";
import { AssignmentDetailDialog, AssignmentMenu, StateBadge } from "./AssignmentRow";
import { useAssignmentActions } from "./useAssignmentActions";
import { EditExerciseAssignmentDialog } from "./EditExerciseAssignmentDialog";
import { useTrainers } from "../api";
import { selectRole } from "../../auth/sessionSlice";
import { dayLabel, prescription } from "../../exercisedb/format";
import { useUrlState } from "../../../shared/hooks/useUrlState";
import { Avatar, Button, Card, CardHeader, DataTable, EmptyState, FilterChips, InlineAlert, KpiTile, PageHeader, Pagination, Select } from "../../../shared/ui";
import { gymDayKey } from "../../../shared/lib/format";

const DEFAULTS = { range: "this_week", trainer: "", status: "all", page: 1 };
const LIMIT = 25;

const shift = (dayKey, days) => new Date(Date.parse(`${dayKey}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

/** Gym-calendar date ranges (Monday–Sunday weeks). */
function rangeFor(range, todayKey = gymDayKey()) {
  const monday = shift(todayKey, -((new Date(`${todayKey}T00:00:00Z`).getUTCDay() + 6) % 7));
  if (range === "last_week") return { from: shift(monday, -7), to: shift(monday, -1) };
  if (range === "next_week") return { from: shift(monday, 7), to: shift(monday, 13) };
  if (range === "last_30") return { from: shift(todayKey, -29), to: todayKey };
  return { from: monday, to: shift(monday, 6) };
}

const RANGES = [
  { value: "last_week", label: "Last week" },
  { value: "this_week", label: "This week" },
  { value: "next_week", label: "Next week" },
  { value: "last_30", label: "Last 30 days" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "todo", label: "To do" },
  { value: "done", label: "Done" },
  { value: "missed", label: "Missed" },
  { value: "cancelled", label: "Removed" },
];

const rate = (r) => (r == null ? "—" : `${r}%`);

/** Staff → Assigned exercises: every member's ExerciseDB exercises, and whether they're being done. */
export default function AssignedExercisesPage() {
  const role = useSelector(selectRole);
  const isTrainer = role === "trainer";
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const trainers = useTrainers();
  const { from, to } = rangeFor(filters.range);
  const query = useExerciseAssignments({
    from,
    to,
    trainerId: isTrainer ? undefined : filters.trainer || undefined,
    status: filters.status,
    page: filters.page,
    limit: LIMIT,
  });
  const data = query.data;
  const actions = useAssignmentActions();
  const [assigning, setAssigning] = useState(false);
  const [editing, setEditing] = useState(null);
  const [open, setOpen] = useState(null);
  const todayKey = data?.todayKey || gymDayKey();
  const s = data?.summary;

  const columns = [
    { id: "day", header: "Day", cell: (a) => <span className="whitespace-nowrap text-ink-2">{dayLabel(a.dayKey, todayKey)}</span> },
    {
      id: "member",
      header: "Member",
      cell: (a) =>
        a.member ? (
          <Link to={`/admin/members/${a.member._id}?tab=workouts`} className="flex items-center gap-2.5">
            <Avatar name={a.member.name} src={a.member.profilePhoto} size="sm" />
            <span className="min-w-0">
              <span className="block truncate font-semibold text-ink hover:underline">{a.member.name}</span>
              {a.member.memberCode && <span className="block text-xs text-ink-3">{a.member.memberCode}</span>}
            </span>
          </Link>
        ) : (
          <span className="text-ink-3">Removed member</span>
        ),
    },
    {
      id: "exercise",
      header: "Exercise",
      cell: (a) => (
        <button type="button" onClick={() => setOpen(a)} className="text-left">
          <span className="block font-semibold text-ink hover:underline">{a.exercise.name}</span>
          <span className="block text-[13px] text-ink-3">{prescription(a) || "No sets or time given"}</span>
          {a.memberNote && <span className="block text-[13px] text-ink-2">“{a.memberNote}”</span>}
        </button>
      ),
    },
    { id: "trainer", header: "Trainer", hideBelow: "lg", cell: (a) => <span className="text-ink-2">{a.trainer?.name || "—"}</span> },
    { id: "status", header: "Status", cell: (a) => <StateBadge a={a} /> },
    {
      id: "actions",
      header: <span className="sr-only">Actions</span>,
      align: "right",
      cell: (a) => <AssignmentMenu a={a} todayKey={todayKey} actions={actions} onEdit={setEditing} onOpen={setOpen} />,
    },
  ];

  const mobileRow = (a) => (
    <div className="flex items-start gap-3 px-4 py-3">
      <button type="button" onClick={() => setOpen(a)} className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-ink">{a.exercise.name}</span>
        <span className="block text-[13px] text-ink-3">
          {[a.member?.name, dayLabel(a.dayKey, todayKey), prescription(a, { rest: false })].filter(Boolean).join(" · ")}
        </span>
      </button>
      <StateBadge a={a} />
      <AssignmentMenu a={a} todayKey={todayKey} actions={actions} onEdit={setEditing} onOpen={setOpen} />
    </div>
  );

  return (
    <>
      <PageHeader
        title="Assigned exercises"
        description={
          isTrainer
            ? "Exercises you scheduled for your members, and who is doing them."
            : "ExerciseDB exercises trainers scheduled for members, and who is doing them."
        }
        actions={
          <Button variant="primary" icon={CalendarPlus} onClick={() => setAssigning(true)}>
            Assign exercises
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <FilterChips label="Dates" value={filters.range} onChange={(range) => setFilters({ range, page: 1 })} options={RANGES} />
          {!isTrainer && (
            <Select
              aria-label="Trainer"
              value={filters.trainer}
              onChange={(e) => setFilters({ trainer: e.target.value, page: 1 })}
              className="md:ml-auto md:w-56"
            >
              <option value="">All trainers</option>
              {(trainers.data || []).map((t) => (
                <option key={t._id} value={t._id}>
                  {t.name}
                </option>
              ))}
              <option value="none">No trainer</option>
            </Select>
          )}
        </div>
      </div>

      {data?.linked === false ? (
        <Card>
          <EmptyState
            icon={Users}
            title="Your login isn’t linked to a trainer profile"
            body="Ask the owner to link it under Trainers. Then your members and their exercises show here."
          />
        </Card>
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiTile label="Members with exercises" value={s?.members ?? 0} icon={Users} loading={query.isPending} />
            <KpiTile
              label="Exercises assigned"
              value={s?.total ?? 0}
              sub={s ? `${s.todo} still to come` : undefined}
              icon={ListChecks}
              loading={query.isPending}
            />
            <KpiTile label="Done" value={s?.done ?? 0} sub={s?.missed ? `${s.missed} missed` : "None missed"} icon={CheckCircle2} loading={query.isPending} />
            <KpiTile label="Completion" value={rate(s?.completionRate)} sub="Of exercises already due" icon={Percent} loading={query.isPending} />
          </div>

          {!isTrainer && data?.byTrainer?.length > 0 && (
            <Card className="mb-4">
              <CardHeader title="By trainer" description="Exercises due so far that were done." />
              <ul className="flex flex-col divide-y divide-line">
                {data.byTrainer.map((r) => (
                  <li key={r.trainer?._id || "none"} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5 first:pt-0 last:pb-0">
                    <span className="min-w-40 flex-1 font-semibold">{r.trainer?.name || "No trainer"}</span>
                    <span className="tabular text-[13px] text-ink-3">
                      {r.members} {r.members === 1 ? "member" : "members"}
                    </span>
                    <span className="tabular text-[13px] text-ink-3">
                      {r.done} of {r.total} done
                    </span>
                    {r.missed > 0 && (
                      <span className="tabular inline-flex items-center gap-1 text-[13px] font-semibold text-warn">
                        <TriangleAlert className="size-3.5" aria-hidden />
                        {r.missed} missed
                      </span>
                    )}
                    <span className="tabular w-14 text-right font-bold">{rate(r.completionRate)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <FilterChips label="Status" className="mb-3" value={filters.status} onChange={(status) => setFilters({ status, page: 1 })} options={STATUS_OPTIONS} />
          {query.isError && data && (
            <InlineAlert tone="danger" className="mb-3">
              {query.error?.message}
            </InlineAlert>
          )}
          <Card padding="none" className="overflow-hidden">
            <DataTable
              caption="Assigned exercises"
              columns={columns}
              rows={data?.items}
              mobileRow={mobileRow}
              isPending={query.isPending}
              isFetching={query.isFetching && query.isPlaceholderData}
              error={query.error}
              onRetry={() => query.refetch()}
              empty={
                <EmptyState
                  icon={ListChecks}
                  title={filters.status === "all" ? "Nothing scheduled for these dates" : "Nothing matches"}
                  body={
                    filters.status === "all" ? "Assign exercises from ExerciseDB to a member, or open a member's Workouts tab." : "Try another status or dates."
                  }
                  action={
                    filters.status === "all" && (
                      <Button variant="primary" icon={CalendarPlus} onClick={() => setAssigning(true)}>
                        Assign exercises
                      </Button>
                    )
                  }
                />
              }
            />
            {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
          </Card>
        </>
      )}

      <AssignExercisesDialog open={assigning} onClose={() => setAssigning(false)} />
      <EditExerciseAssignmentDialog open={Boolean(editing)} assignment={editing} onClose={() => setEditing(null)} />
      <AssignmentDetailDialog a={open} todayKey={todayKey} onClose={() => setOpen(null)} />
    </>
  );
}
