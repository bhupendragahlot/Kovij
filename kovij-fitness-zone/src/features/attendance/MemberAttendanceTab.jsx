import { useState } from "react";
import { CalendarCheck, DoorOpen } from "lucide-react";
import { useMemberAttendanceHistory, useMemberAttendanceMonth, useMemberAttendanceSummary } from "./api";
import { MemberMonthCalendar, MonthPicker, VisitStatusBadge, VisitsTrendChart } from "./components";
import { MemberQrCard } from "./MemberQrCard";
import { METHOD_LABEL, formatDayShort, formatDuration, recordedByLine } from "./lib";
import { usePermission } from "../auth/permissions";
import { Badge, Card, CardHeader, DataTable, EmptyState, ErrorState, KpiTile, Pagination, Skeleton } from "../../shared/ui";
import { formatRelativeTime, formatTime, gymDayKey, pluralize } from "../../shared/lib/format";

const LIMIT = 10;

function Stats({ summary }) {
  const s = summary.data;
  const loading = summary.isPending;
  if (summary.isError && !s) return <ErrorState compact error={summary.error} onRetry={() => summary.refetch()} />;
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <KpiTile label="Last 30 days" loading={loading} value={s ? pluralize(s.last30Days, "visit") : ""} sub={s?.lastVisitAt ? `Last in ${formatRelativeTime(s.lastVisitAt)}` : "No visits yet"} />
      <KpiTile
        label="Streak"
        loading={loading}
        value={s ? pluralize(s.streak.current, "day") : ""}
        sub={s ? `Longest ${pluralize(s.streak.longest, "day")}. Closed days don't break it.` : ""}
      />
      <KpiTile label="This month" loading={loading} value={s ? pluralize(s.thisMonth, "visit") : ""} sub={s ? `${pluralize(s.total, "visit")} in total` : ""} />
      <KpiTile
        label="Average visit"
        loading={loading}
        value={s?.averageMinutes != null ? formatDuration(s.averageMinutes) : "—"}
        sub={s?.averageMinutes != null ? "From visits with a check-out" : "Needs visits with a check-out"}
      />
    </div>
  );
}

/**
 * Member profile tab: "Attendance". Receives { member, attendance } from the profile and loads
 * the rest: headline numbers, a month calendar, visits per month, the visit list, and (for the
 * desk) the member's entry QR code.
 */
export default function MemberAttendanceTab({ member }) {
  const [month, setMonth] = useState(() => gymDayKey().slice(0, 7));
  const [page, setPage] = useState(1);
  const canCheckIn = usePermission("attendance.checkin");
  const summary = useMemberAttendanceSummary(member._id);
  const calendar = useMemberAttendanceMonth(member._id, month);
  const history = useMemberAttendanceHistory(member._id, { page, limit: LIMIT });

  const columns = [
    { id: "date", header: "Date", cell: (v) => <span className="whitespace-nowrap font-semibold">{formatDayShort(v.dayKey)}</span> },
    { id: "in", header: "In", cell: (v) => <span className="tabular">{formatTime(v.checkedInAt)}</span> },
    { id: "out", header: "Out", cell: (v) => (v.checkedOutAt ? <span className="tabular">{formatTime(v.checkedOutAt)}</span> : <VisitStatusBadge status={v.status} />) },
    { id: "duration", header: "Time in gym", cell: (v) => (v.durationMinutes != null ? formatDuration(v.durationMinutes) : <span className="text-ink-3">—</span>) },
    { id: "how", header: "Checked in by", hideBelow: "lg", cell: (v) => <span className="text-ink-2">{recordedByLine(v.method, v.recordedBy)}</span> },
    {
      id: "note",
      header: <span className="sr-only">Notes</span>,
      hideBelow: "lg",
      cell: (v) =>
        v.membershipStatus !== "active" ? (
          <Badge tone="warn" size="sm" icon={DoorOpen}>
            Let in once{v.overrideReason ? `: ${v.overrideReason}` : ""}
          </Badge>
        ) : null,
    },
  ];

  const mobileRow = (v) => (
    <div className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{formatDayShort(v.dayKey)}</p>
        <p className="tabular text-body-sm text-ink-3">
          {formatTime(v.checkedInAt)}
          {v.checkedOutAt ? ` – ${formatTime(v.checkedOutAt)}, ${formatDuration(v.durationMinutes)}` : ""}
          {` · ${METHOD_LABEL[v.method] || v.method}`}
        </p>
        {v.membershipStatus !== "active" && (
          <Badge tone="warn" size="sm" icon={DoorOpen} className="mt-1">
            Let in once
          </Badge>
        )}
      </div>
      {!v.checkedOutAt && <VisitStatusBadge status={v.status} />}
    </div>
  );

  const cal = calendar.data;
  return (
    <div className="flex flex-col gap-4">
      <Stats summary={summary} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="lg">
          <CardHeader
            title="Days visited"
            description={cal ? `${pluralize(cal.daysVisited, "day")} out of ${pluralize(cal.openDays, "open day")} so far` : undefined}
            action={<MonthPicker value={month} onChange={setMonth} />}
            className="flex-wrap"
          />
          {calendar.isPending ? (
            <Skeleton className="h-64 w-full rounded-tile" />
          ) : calendar.isError && !cal ? (
            <ErrorState compact error={calendar.error} onRetry={() => calendar.refetch()} />
          ) : (
            <div className={calendar.isFetching && calendar.isPlaceholderData ? "opacity-60 transition-opacity" : undefined}>
              <MemberMonthCalendar days={cal.days} />
            </div>
          )}
        </Card>

        <Card padding="lg">
          {summary.isPending ? (
            <Skeleton className="h-56 w-full rounded-tile" />
          ) : summary.data ? (
            <VisitsTrendChart data={summary.data.trend} />
          ) : (
            <ErrorState compact error={summary.error} onRetry={() => summary.refetch()} />
          )}
        </Card>
      </div>

      <Card padding="none" className="overflow-hidden">
        <CardHeader
          title="Visit history"
          description={history.data ? `${pluralize(history.data.total, "visit")}, newest first` : undefined}
          className="px-5 pt-5"
        />
        <DataTable
          caption="Visit history"
          columns={columns}
          rows={history.data?.items}
          mobileRow={mobileRow}
          isPending={history.isPending}
          isFetching={history.isFetching && history.isPlaceholderData}
          error={history.error}
          onRetry={() => history.refetch()}
          empty={
            <EmptyState
              compact
              icon={CalendarCheck}
              title={`${member.name} hasn't checked in yet`}
              body={canCheckIn ? "Check them in from the Check-in page, or print their QR card below for the kiosk." : "Visits appear here after the first check-in."}
            />
          }
        />
        {history.data && <Pagination page={page} limit={LIMIT} total={history.data.total} onPage={setPage} />}
      </Card>

      {canCheckIn && <MemberQrCard member={member} />}
    </div>
  );
}
