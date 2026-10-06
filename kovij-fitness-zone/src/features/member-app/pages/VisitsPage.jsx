import { useState } from "react";
import { ChevronLeft, ChevronRight, Flame, Footprints, Trophy } from "lucide-react";
import { useAttendanceHistory, useAttendanceMonth, useStreak } from "../queries";
import { Card, CardHeader, EmptyState, ErrorState, IconButton, PageHeader, Pagination, Skeleton, SkeletonList } from "../../../shared/ui";
import { formatDate, formatMonth, formatNumber, formatTime, gymDayKey, pluralize } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

const shiftMonth = (ym, n) => {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
};

export default function VisitsPage() {
  const thisMonth = gymDayKey().slice(0, 7);
  const [month, setMonth] = useState(thisMonth);
  const [page, setPage] = useState(1);
  const streak = useStreak().data;
  const cal = useAttendanceMonth(month);
  const history = useAttendanceHistory(page);

  return (
    <>
      <PageHeader title="Visits" />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Flame, label: "Streak", value: streak ? pluralize(streak.current, "day") : "…" },
            { icon: Trophy, label: "Best streak", value: streak ? pluralize(streak.longest, "day") : "…" },
            { icon: Footprints, label: "Last 30 days", value: streak ? formatNumber(streak.last30Days) : "…" },
          ].map((t) => (
            <Card key={t.label} className="p-3.5">
              <p className="flex items-center gap-1.5 text-label font-semibold text-ink-3">
                <t.icon className="size-3.5" aria-hidden />
                {t.label}
              </p>
              <p className="tabular mt-1 text-title-lg font-bold">{t.value}</p>
            </Card>
          ))}
        </div>

        <Card>
          <div className="mb-4 flex items-center justify-between gap-2">
            <IconButton icon={ChevronLeft} label="Previous month" variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, -1))} />
            <div className="text-center">
              <h2 className="text-title-lg font-bold">
                {formatMonth(month)} {month.slice(0, 4)}
              </h2>
              {cal.data && <p className="text-body-sm text-ink-3">{pluralize(cal.data.daysVisited, "visit")} of {pluralize(cal.data.openDays, "open day")}</p>}
            </div>
            <IconButton icon={ChevronRight} label="Next month" variant="secondary" size="sm" onClick={() => setMonth(shiftMonth(month, 1))} disabled={month >= thisMonth} />
          </div>
          {cal.isPending ? <Skeleton className="h-64" /> : cal.isError ? <ErrorState compact error={cal.error} onRetry={() => cal.refetch()} /> : <MonthGrid month={month} days={cal.data.days} />}
        </Card>

        <Card>
          <CardHeader title="Every visit" />
          {history.isPending ? (
            <SkeletonList rows={4} />
          ) : history.isError ? (
            <ErrorState compact error={history.error} onRetry={() => history.refetch()} />
          ) : !history.data.items.length ? (
            <EmptyState compact icon={Footprints} title="No visits yet" body="Show your pass at the desk or the scanner, and your visits appear here." />
          ) : (
            <>
              <ul className="flex flex-col divide-y divide-line">
                {history.data.items.map((v) => (
                  <li key={v._id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                    <span className="font-semibold">{formatDate(`${v.date}T12:00:00+05:30`)}</span>
                    <span className="tabular text-sm text-ink-3">
                      {formatTime(v.checkedInAt)}
                      {v.checkedOutAt ? ` – ${formatTime(v.checkedOutAt)}` : ""}
                      {v.durationMinutes ? ` · ${Math.floor(v.durationMinutes / 60) ? `${Math.floor(v.durationMinutes / 60)} h ` : ""}${v.durationMinutes % 60} min` : ""}
                    </span>
                  </li>
                ))}
              </ul>
              <Pagination page={page} limit={history.data.limit} total={history.data.total} onPage={setPage} />
            </>
          )}
        </Card>
      </div>
    </>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];

function MonthGrid({ month, days }) {
  const first = new Date(`${month}-01T12:00:00Z`).getUTCDay(); // 0 = Sunday
  const lead = (first + 6) % 7;
  const count = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));
  const today = gymDayKey();
  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-center text-label font-semibold text-ink-3" aria-hidden>
        {WEEK.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`x${i}`} aria-hidden />
        ))}
        {Array.from({ length: count }, (_, i) => {
          const date = `${month}-${String(i + 1).padStart(2, "0")}`;
          const d = byDate[date];
          const visited = Boolean(d?.visit);
          const closed = d && !d.open;
          return (
            <li
              key={date}
              className={cn(
                "grid aspect-square place-items-center rounded-full text-body-sm font-semibold",
                visited ? "bg-brand text-on-brand" : date === today ? "border-2 border-dashed border-brand" : closed ? "text-ink-3/50" : date > today ? "text-ink-3" : "text-ink-2"
              )}
              aria-label={`${formatDate(`${date}T12:00:00+05:30`)}: ${visited ? "visited" : d?.holiday ? `closed for ${d.holiday}` : closed ? "gym closed" : "no visit"}`}
              title={d?.holiday || undefined}
            >
              {i + 1}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 flex items-center gap-2 text-label text-ink-3">
        <span className="size-3 rounded-full bg-brand" aria-hidden /> Visited
        <span className="ml-3 size-3 rounded-full border-2 border-dashed border-brand" aria-hidden /> Today
      </p>
    </div>
  );
}
