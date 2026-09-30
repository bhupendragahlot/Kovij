import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardList, DoorOpen, Download, Ellipsis, LogOut, MonitorSmartphone, ScrollText, Undo2, Users } from "lucide-react";
import {
  downloadAttendanceCsv,
  useAttendance,
  useAttendanceMonth,
  useCheckOut,
  useMonthMembers,
  useUndoCheckIn,
  useUndoCheckOut,
} from "./api";
import { DayHourlyChart, DayPicker, MonthHeatmap, MonthPicker, VisitStatusBadge } from "./components";
import { EVENT_META, METHOD_LABEL, formatDayLong, formatDayShort, formatDuration, recordedByLine } from "./lib";
import { usePermission } from "../auth/permissions";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { newIdempotencyKey } from "../../shared/lib/apiClient";
import {
  Avatar,
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  DataTable,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  KpiTile,
  Menu,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
  Tabs,
  useToast,
} from "../../shared/ui";
import { formatNumber, formatRelativeTime, formatTime, gymDayKey, pluralize } from "../../shared/lib/format";

const DEFAULTS = { view: "day", date: "", month: "", status: "all", q: "", page: 1 };
const MEMBERS_LIMIT = 25;

const matches = (v, term) => {
  if (!term) return true;
  const t = term.toLowerCase();
  return v.memberId.name.toLowerCase().includes(t) || (v.memberId.memberCode || "").toLowerCase().includes(t) || (v.memberId.phone || "").includes(t);
};

const STATUS_FILTERS = {
  all: () => true,
  in: (v) => v.status === "in",
  out: (v) => v.status === "out",
  no_check_out: (v) => v.status === "no_check_out",
  let_in: (v) => v.membershipStatus !== "active",
};

function VisitActions({ visit, isToday }) {
  const toast = useToast();
  const checkOut = useCheckOut();
  const undoOut = useUndoCheckOut();
  const undoIn = useUndoCheckIn();
  const canCheckIn = usePermission("attendance.checkin");
  if (!canCheckIn || !isToday) return null;
  const name = visit.memberId.name;
  const fail = (verb) => (e) => toast.error(`Couldn't ${verb}`, { description: e.message });
  return (
    <Menu
      label={`Actions for ${name}`}
      trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${name}`} size="sm" />}
      items={[
        visit.status === "in" && {
          label: "Check out",
          icon: LogOut,
          onSelect: () =>
            checkOut.mutate(
              { attendanceId: visit._id, idempotencyKey: newIdempotencyKey() },
              { onSuccess: (r) => toast.success(`${name} checked out`, { description: `In the gym for ${formatDuration(r.attendance.minutesInGym)} today` }), onError: fail("check out") }
            ),
        },
        visit.checkedOutAt && {
          label: "Undo check-out",
          icon: Undo2,
          onSelect: () => undoOut.mutate(visit._id, { onSuccess: () => toast.info(`Check-out for ${name} undone`), onError: fail("undo") }),
        },
        {
          label: "Undo check-in",
          icon: Undo2,
          tone: "danger",
          onSelect: () => undoIn.mutate(visit._id, { onSuccess: () => toast.info(`Check-in for ${name} undone`), onError: fail("undo") }),
        },
      ]}
    />
  );
}

function DeskLog({ events }) {
  const [showAll, setShowAll] = useState(false);
  const shown = showAll ? events : events.slice(0, 12);
  return (
    <Card padding="lg">
      <CardHeader title="Desk log" description="Every check-in, check-out, undo and refusal, with who did it and how." />
      {events.length === 0 ? (
        <EmptyState compact icon={ScrollText} title="Nothing logged on this day" body="Check-ins, check-outs and refused entries appear here as they happen." />
      ) : (
        <>
          <ol className="flex flex-col divide-y divide-line">
            {shown.map((e) => {
              const meta = EVENT_META[e.type] || EVENT_META.check_in;
              return (
                <li key={e._id} className="flex items-start gap-3 py-2.5">
                  <span className="tabular w-16 shrink-0 pt-0.5 text-[13px] font-semibold text-ink-3">{formatTime(e.at)}</span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                      <Badge tone={meta.tone} icon={meta.icon} size="sm">
                        {meta.label}
                      </Badge>
                      {e.member ? (
                        <Link to={`/admin/members/${e.member._id}`} className="font-semibold text-ink hover:underline">
                          {e.member.name}
                        </Link>
                      ) : (
                        <span className="text-ink-3">Removed member</span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[13px] text-ink-3">
                      {recordedByLine(e.method, e.byName)}
                      {e.reason ? `. ${e.type === "refused" ? "Reason" : "Note"}: ${e.reason}` : ""}
                      {e.type === "undo_check_in" && e.details?.checkedInAt ? `. Had checked in at ${formatTime(e.details.checkedInAt)}` : ""}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
          {events.length > shown.length && (
            <Button variant="ghost" className="mt-2" onClick={() => setShowAll(true)}>
              Show all {formatNumber(events.length)} entries
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function DayView({ date, onDate, filters, setFilters }) {
  const day = useAttendance(date);
  const [search, setSearch] = useState(filters.q);
  const term = useDebouncedValue(search.trim(), 200);
  useEffect(() => {
    if (term !== filters.q) setFilters({ q: term });
  }, [term, filters.q, setFilters]);

  const data = day.data;
  const all = useMemo(() => data?.items || [], [data]);
  const searched = useMemo(() => all.filter((v) => matches(v, filters.q)), [all, filters.q]);
  const rows = searched.filter(STATUS_FILTERS[filters.status] || STATUS_FILTERS.all);
  const count = (key) => searched.filter(STATUS_FILTERS[key]).length;
  const s = data?.summary;
  const isToday = date === gymDayKey();

  const columns = [
    {
      id: "member",
      header: "Member",
      cell: (v) => (
        <Link to={`/admin/members/${v.memberId._id}`} className="flex items-center gap-3">
          <Avatar name={v.memberId.name} src={v.memberId.profilePhoto} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold hover:underline">{v.memberId.name}</span>
            <span className="block text-[13px] text-ink-3">{v.memberId.memberCode}</span>
          </span>
        </Link>
      ),
    },
    { id: "in", header: "In", cell: (v) => <span className="tabular whitespace-nowrap">{formatTime(v.checkedInAt)}</span> },
    {
      id: "out",
      header: "Out",
      cell: (v) => (v.checkedOutAt ? <span className="tabular whitespace-nowrap">{formatTime(v.checkedOutAt)}</span> : <VisitStatusBadge status={v.status} />),
    },
    { id: "duration", header: "Time in gym", hideBelow: "lg", cell: (v) => (v.durationMinutes != null ? formatDuration(v.durationMinutes) : <span className="text-ink-3">—</span>) },
    {
      id: "how",
      header: "Checked in by",
      hideBelow: "xl",
      cell: (v) => (
        <span className="text-ink-2">
          {recordedByLine(v.method, v.recordedBy)}
          {v.entries > 1 && <span className="block text-[13px] text-ink-3">Came in {v.entries} times</span>}
        </span>
      ),
    },
    {
      id: "note",
      header: "Notes",
      hideBelow: "lg",
      cell: (v) =>
        v.membershipStatus !== "active" ? (
          <Badge tone="warn" size="sm" icon={DoorOpen}>
            Let in once{v.overrideReason ? `: ${v.overrideReason}` : ""}
          </Badge>
        ) : null,
    },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: (v) => <VisitActions visit={v} isToday={isToday} /> },
  ];

  const mobileRow = (v) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <Link to={`/admin/members/${v.memberId._id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Avatar name={v.memberId.name} src={v.memberId.profilePhoto} />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold">{v.memberId.name}</span>
          <span className="tabular block text-[13px] text-ink-3">
            {formatTime(v.checkedInAt)}
            {v.checkedOutAt ? ` – ${formatTime(v.checkedOutAt)}, ${formatDuration(v.durationMinutes)}` : ""} · {METHOD_LABEL[v.method] || v.method}
          </span>
          <span className="mt-1 flex flex-wrap gap-1.5">
            {!v.checkedOutAt && <VisitStatusBadge status={v.status} />}
            {v.membershipStatus !== "active" && (
              <Badge tone="warn" size="sm" icon={DoorOpen}>
                Let in once
              </Badge>
            )}
          </span>
        </span>
      </Link>
      <VisitActions visit={v} isToday={isToday} />
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <DayPicker value={date} onChange={onDate} />
        <p className="text-sm font-semibold text-ink-2">{isToday ? `Today, ${formatDayLong(date)}` : formatDayLong(date)}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Visits" loading={day.isPending} value={s ? formatNumber(s.visits) : ""} sub={s ? `${formatNumber(s.byMethod.kiosk)} at the kiosk, ${formatNumber(s.byMethod.qr)} by QR at the desk` : ""} />
        <KpiTile
          label={isToday && !data?.pastClosing ? "In the gym now" : "No check-out"}
          loading={day.isPending}
          value={s ? formatNumber(isToday && !data?.pastClosing ? s.inGym : s.noCheckOut) : ""}
          sub={s ? `${formatNumber(s.checkedOut)} checked out` : ""}
        />
        <KpiTile
          label="Average visit"
          loading={day.isPending}
          value={s?.averageMinutes != null ? formatDuration(s.averageMinutes) : "—"}
          sub={s?.averageMinutes != null ? "From visits with a check-out" : "No check-outs yet"}
        />
        <KpiTile label="Let in once" loading={day.isPending} value={s ? formatNumber(s.letInOnce) : ""} sub="Without an active plan" />
      </div>

      <Card padding="lg">
        {day.isPending ? (
          <Skeleton className="h-56 w-full rounded-tile" />
        ) : data ? (
          <DayHourlyChart data={data.byHour} isToday={isToday} />
        ) : (
          <ErrorState compact error={day.error} onRetry={() => day.refetch()} />
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <CardHeader className="mb-0" title="Visits" description={data ? `${pluralize(data.total, "visit")} on this day` : undefined} />
          <SearchInput value={search} onChange={setSearch} label="Filter by member" placeholder="Member name, code or phone" className="lg:max-w-sm" />
          <FilterChips
            label="Visit status"
            value={filters.status}
            onChange={(status) => setFilters({ status })}
            options={[
              { value: "all", label: "All", count: searched.length },
              { value: "in", label: "In gym", count: count("in") },
              { value: "out", label: "Checked out", count: count("out") },
              { value: "no_check_out", label: "No check-out", count: count("no_check_out") },
              { value: "let_in", label: "Let in once", count: count("let_in") },
            ]}
          />
        </div>
        <DataTable
          caption="Visits"
          columns={columns}
          rows={rows}
          mobileRow={mobileRow}
          isPending={day.isPending}
          isFetching={day.isFetching && day.isPlaceholderData}
          error={day.error}
          onRetry={() => day.refetch()}
          empty={
            all.length === 0 ? (
              <EmptyState
                icon={ClipboardList}
                title={isToday ? "No one has checked in yet" : "No visits on this day"}
                body={isToday ? "Check-ins from the desk and the kiosk appear here with their times." : "Pick another day, or go back to today."}
                action={
                  isToday ? (
                    <ButtonLink to="/admin/check-in" variant="secondary">
                      Go to check-in
                    </ButtonLink>
                  ) : (
                    <Button variant="secondary" onClick={() => onDate(gymDayKey())}>
                      Back to today
                    </Button>
                  )
                }
              />
            ) : (
              <EmptyState
                compact
                icon={Users}
                title="No visits match"
                body="Try another name, or clear the filters."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setSearch("");
                      setFilters({ q: "", status: "all" });
                    }}
                  >
                    Clear filters
                  </Button>
                }
              />
            )
          }
        />
      </Card>

      {data && <DeskLog key={date} events={data.events} />}
    </div>
  );
}

function MonthView({ month, onMonth, onOpenDay, filters, setFilters }) {
  const summary = useAttendanceMonth(month);
  const [search, setSearch] = useState(filters.q);
  const term = useDebouncedValue(search.trim(), 300);
  useEffect(() => {
    if (term !== filters.q) setFilters({ q: term });
  }, [term, filters.q, setFilters]);
  const members = useMonthMembers({ month, q: filters.q || undefined, page: filters.page, limit: MEMBERS_LIMIT });
  const canExport = usePermission("reports.view");
  const toast = useToast();
  const [exporting, setExporting] = useState(null);
  const t = summary.data?.totals;

  const exportCsv = async (kind) => {
    setExporting(kind);
    try {
      await downloadAttendanceCsv({ month, kind });
      toast.success("CSV downloaded", { description: kind === "members" ? "One row per member with their visit count." : "One row per visit." });
    } catch (e) {
      toast.error("Couldn't download the CSV", { description: e.message });
    } finally {
      setExporting(null);
    }
  };

  const columns = [
    {
      id: "member",
      header: "Member",
      cell: (r) => (
        <Link to={`/admin/members/${r.member._id}`} className="flex items-center gap-3">
          <Avatar name={r.member.name} src={r.member.profilePhoto} size="sm" />
          <span className="min-w-0">
            <span className="block truncate font-semibold hover:underline">{r.member.name}</span>
            <span className="block text-[13px] text-ink-3">{r.member.memberCode}</span>
          </span>
        </Link>
      ),
    },
    { id: "visits", header: "Visits", align: "right", cell: (r) => <span className="font-semibold">{formatNumber(r.visits)}</span> },
    { id: "last", header: "Last visit", hideBelow: "md", cell: (r) => <span className="whitespace-nowrap">{formatDayShort(gymDayKey(r.lastVisitAt))}</span> },
    { id: "avg", header: "Average visit", hideBelow: "lg", cell: (r) => (r.averageMinutes != null ? formatDuration(r.averageMinutes) : <span className="text-ink-3">—</span>) },
  ];
  const mobileRow = (r) => (
    <Link to={`/admin/members/${r.member._id}`} className="flex items-center gap-3 px-4 py-3">
      <Avatar name={r.member.name} src={r.member.profilePhoto} />
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{r.member.name}</span>
        <span className="block text-[13px] text-ink-3">Last in {formatRelativeTime(r.lastVisitAt)}</span>
      </span>
      <span className="text-right">
        <span className="block font-bold">{formatNumber(r.visits)}</span>
        <span className="block text-[12px] text-ink-3">{r.visits === 1 ? "visit" : "visits"}</span>
      </span>
    </Link>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <MonthPicker value={month} onChange={onMonth} />
        {canExport && (
          <Menu
            label="Download CSV"
            trigger={(props) => (
              <Button {...props} variant="secondary" icon={Download} loading={Boolean(exporting)}>
                Download CSV
              </Button>
            )}
            items={[
              { label: "Every visit", icon: ClipboardList, onSelect: () => exportCsv("visits") },
              { label: "Visits per member", icon: Users, onSelect: () => exportCsv("members") },
            ]}
          />
        )}
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile label="Visits" loading={summary.isPending} value={t ? formatNumber(t.visits) : ""} />
        <KpiTile label="Members who came" loading={summary.isPending} value={t ? formatNumber(t.members) : ""} />
        <KpiTile label="Average per open day" loading={summary.isPending} value={t ? formatNumber(t.averagePerOpenDay) : ""} />
        <KpiTile
          label="Busiest day"
          loading={summary.isPending}
          value={t?.busiestDay ? formatDayShort(t.busiestDay.date) : "—"}
          sub={t?.busiestDay ? pluralize(t.busiestDay.visits, "visit") : "No visits yet"}
        />
      </div>

      <Card padding="lg">
        <CardHeader title="Visits per day" description="Tap a day to see who came." />
        {summary.isPending ? (
          <Skeleton className="h-72 w-full rounded-tile" />
        ) : summary.isError && !summary.data ? (
          <ErrorState compact error={summary.error} onRetry={() => summary.refetch()} />
        ) : (
          <div className={summary.isFetching && summary.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
            <MonthHeatmap days={summary.data.days} onSelectDay={onOpenDay} />
          </div>
        )}
      </Card>

      <Card padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-3 p-4 sm:p-5">
          <CardHeader className="mb-0" title="Visits per member" description={members.data ? `${pluralize(members.data.total, "member")} came this month` : undefined} />
          <SearchInput value={search} onChange={setSearch} label="Search members" placeholder="Member name or code" className="lg:max-w-sm" />
        </div>
        <DataTable
          caption="Visits per member"
          columns={columns}
          rows={members.data?.items}
          getRowId={(r) => r.member._id}
          mobileRow={mobileRow}
          isPending={members.isPending}
          isFetching={members.isFetching && members.isPlaceholderData}
          error={members.error}
          onRetry={() => members.refetch()}
          empty={
            <EmptyState
              compact
              icon={Users}
              title={filters.q ? "No member matches" : "No visits this month"}
              body={filters.q ? "Try another name or code." : "Members appear here after their first check-in of the month."}
            />
          }
        />
        {members.data && <Pagination page={filters.page} limit={MEMBERS_LIMIT} total={members.data.total} onPage={(page) => setFilters({ page })} />}
      </Card>
    </div>
  );
}

export default function AttendancePage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const canCheckIn = usePermission("attendance.checkin");
  const today = gymDayKey();
  const date = filters.date && filters.date <= today ? filters.date : today;
  const month = filters.month || today.slice(0, 7);

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Who came in, when they left, and how busy each day was."
        actions={
          canCheckIn && (
            <ButtonLink to="/admin/kiosk" variant="secondary" icon={MonitorSmartphone}>
              Open kiosk
            </ButtonLink>
          )
        }
      />
      <Tabs
        label="Attendance views"
        value={filters.view}
        onChange={(view) => setFilters({ view, q: "", status: "all" })}
        className="mb-4"
        tabs={[
          { value: "day", label: "Day" },
          { value: "month", label: "Month" },
        ]}
      />
      <div role="tabpanel" id={`panel-${filters.view}`} aria-labelledby={`tab-${filters.view}`}>
        {filters.view === "month" ? (
          <MonthView
            key={month}
            month={month}
            onMonth={(m) => setFilters({ month: m === today.slice(0, 7) ? "" : m })}
            onOpenDay={(d) => setFilters({ view: "day", date: d === today ? "" : d, q: "", status: "all" })}
            filters={filters}
            setFilters={setFilters}
          />
        ) : (
          <DayView key={date} date={date} onDate={(d) => setFilters({ date: d === today ? "" : d })} filters={filters} setFilters={setFilters} />
        )}
      </div>
    </>
  );
}
