import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, History, KeyRound, ShieldAlert, TriangleAlert, UserRound } from "lucide-react";
import { useActivity, useSignIns } from "./api";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { Badge, Card, EmptyState, FilterChips, PageHeader, Pagination, Select, SkeletonList, Tabs, ErrorState } from "../../shared/ui";
import { formatDateTime, formatNumber, formatTime, gymDayKey, initials } from "../../shared/lib/format";
import { ROLE_LABEL } from "../../shared/domain/status";
import { cn } from "../../shared/lib/cn";

const LIMIT = 30;
const DEFAULTS = { tab: "changes", actorId: "", kind: "", period: "7", page: 1 };

const PERIODS = [
  { value: "1", label: "Today" },
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "180", label: "Everything kept (180 days)" },
];

const KINDS = [
  { value: "", label: "Everything" },
  { value: "create", label: "Added" },
  { value: "update", label: "Changed" },
  { value: "delete", label: "Deleted" },
  { value: "other", label: "Actions" },
  { value: "failed", label: "Refused or failed" },
];

function periodRange(days) {
  const n = Number(days) || 7;
  return { from: gymDayKey(new Date(Date.now() - (n - 1) * 86_400_000)), to: gymDayKey() };
}

const dayFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "long", day: "numeric", month: "short" });
function dayHeading(key) {
  const today = gymDayKey();
  const yesterday = gymDayKey(new Date(Date.now() - 86_400_000));
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return dayFmt.format(new Date(`${key}T12:00:00+05:30`));
}

/** Items grouped under day headings, newest first. */
function byDay(items) {
  const groups = [];
  for (const item of items) {
    const key = gymDayKey(item.at);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

/** OWNER: security module. /admin/activity */
export default function ActivityLogPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  return (
    <>
      <PageHeader title="Activity log" description="Who changed what at the desk, and every sign-in. Kept for 180 days." />
      <Tabs
        label="Activity log sections"
        value={filters.tab}
        onChange={(tab) => setFilters({ tab, kind: "" })}
        tabs={[
          { value: "changes", label: "Changes" },
          { value: "sign-ins", label: "Sign-ins" },
        ]}
        className="mb-5"
      />
      <div role="tabpanel" id={`panel-${filters.tab}`} aria-labelledby={`tab-${filters.tab}`}>
        {filters.tab === "sign-ins" ? <SignInsTab filters={filters} setFilters={setFilters} /> : <ChangesTab filters={filters} setFilters={setFilters} />}
      </div>
    </>
  );
}

function StaffAndPeriod({ filters, setFilters, staff = [], staffLabel = "Staff member", staffKey = "actorId" }) {
  return (
    <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:max-w-2xl">
      <label className="flex flex-col gap-1.5">
        <span className="text-body-sm font-semibold text-ink-3">{staffLabel}</span>
        <Select value={filters[staffKey] || ""} onChange={(e) => setFilters({ [staffKey]: e.target.value })}>
          <option value="">Everyone</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.isActive === false ? " (deactivated)" : ""}
            </option>
          ))}
        </Select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-body-sm font-semibold text-ink-3">When</span>
        <Select value={filters.period} onChange={(e) => setFilters({ period: e.target.value })}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </label>
    </div>
  );
}

function ChangesTab({ filters, setFilters }) {
  const range = periodRange(filters.period);
  const query = useActivity({
    actorId: filters.actorId,
    kind: filters.kind === "failed" ? "" : filters.kind,
    outcome: filters.kind === "failed" ? "failed" : "all",
    ...range,
    page: filters.page,
    limit: LIMIT,
  });
  const data = query.data;
  // The staff list only comes with page 1; keep it while paging.
  const staff = useMemo(() => data?.staff, [data?.staff]);
  const groups = useMemo(() => byDay(data?.items || []), [data?.items]);
  const filtering = Boolean(filters.actorId || filters.kind);

  return (
    <>
      <StaffAndPeriod filters={filters} setFilters={setFilters} staff={staff} />
      <FilterChips label="Type of change" value={filters.kind} onChange={(kind) => setFilters({ kind })} options={KINDS} className="mb-4" />
      <Card padding="none" className="overflow-hidden">
        {query.isPending ? (
          <SkeletonList rows={6} className="p-4" />
        ) : query.isError && !data ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
        ) : !data.items.length ? (
          <EmptyState
            icon={History}
            title={filtering ? "Nothing matches" : "No changes in this period"}
            body={filtering ? "Try everyone, or a longer period." : "Changes made at the desk appear here as they happen."}
          />
        ) : (
          <div className={cn("transition-opacity duration-200", query.isFetching && query.isPlaceholderData && "opacity-60")}>
            {groups.map((g) => (
              <section key={g.key} aria-label={dayHeading(g.key)}>
                <h2 className="border-b border-line bg-surface-2/60 px-4 py-2 text-body-sm font-bold text-ink-3 md:px-5">{dayHeading(g.key)}</h2>
                <ul className="divide-y divide-line">
                  {g.items.map((item) => (
                    <ActivityRow key={item.id} item={item} />
                  ))}
                </ul>
              </section>
            ))}
            <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />
          </div>
        )}
      </Card>
    </>
  );
}

function ActivityRow({ item }) {
  return (
    <li className="flex gap-3 px-4 py-3 md:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-surface-2 text-label font-bold text-ink-2" aria-hidden>
        {initials(item.actor.name)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-body-lg leading-snug">{item.summary}</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-body-sm text-ink-3">
          <time dateTime={item.at} title={formatDateTime(item.at)} className="tabular">
            {formatTime(item.at)}
          </time>
          {item.actor.role && <span>· {ROLE_LABEL[item.actor.role] || item.actor.role}</span>}
          <span className="max-sm:hidden">· {item.device}</span>
          {item.member && (
            <Link to={`/admin/members/${item.member.id}`} className="inline-flex items-center gap-1 font-semibold text-brand-ink hover:underline">
              <UserRound className="size-3.5" aria-hidden />
              {item.member.name}
            </Link>
          )}
        </div>
      </div>
      {!item.ok && (
        <Badge size="sm" tone={item.status === 403 ? "bad" : "warn"} icon={item.status === 403 ? ShieldAlert : TriangleAlert} className="self-start">
          {item.status === 403 ? "Not allowed" : "Didn’t go through"}
        </Badge>
      )}
    </li>
  );
}

const OUTCOMES = [
  { value: "", label: "All" },
  { value: "ok", label: "Signed in" },
  { value: "failed", label: "Failed" },
];

function SignInsTab({ filters, setFilters }) {
  const range = periodRange(filters.period);
  const outcome = filters.kind === "ok" || filters.kind === "failed" ? filters.kind : "";
  const query = useSignIns({ userId: filters.actorId, outcome: outcome || "all", ...range, page: filters.page, limit: LIMIT });
  const staffList = useActivity({ page: 1, limit: 1 }).data?.staff;
  const data = query.data;

  return (
    <>
      <StaffAndPeriod filters={filters} setFilters={setFilters} staff={staffList} />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <FilterChips label="Result" value={outcome} onChange={(kind) => setFilters({ kind })} options={OUTCOMES} />
        {data && (
          <Badge tone={data.failedLast24h >= 5 ? "warn" : "neutral"} icon={KeyRound}>
            {formatNumber(data.failedLast24h)} failed in the last 24 hours
          </Badge>
        )}
      </div>
      <Card padding="none" className="overflow-hidden">
        {query.isPending ? (
          <SkeletonList rows={6} className="p-4" />
        ) : query.isError && !data ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} compact />
        ) : !data.items.length ? (
          <EmptyState icon={KeyRound} title="No sign-ins in this period" body="Every staff sign-in, and every failed attempt, is listed here." />
        ) : (
          <div className={cn("transition-opacity duration-200", query.isFetching && query.isPlaceholderData && "opacity-60")}>
            <ul className="divide-y divide-line">
              {data.items.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 md:px-5">
                  <Badge size="sm" tone={e.success ? "good" : "warn"} icon={e.success ? CircleCheck : TriangleAlert}>
                    {e.reasonLabel}
                  </Badge>
                  <div className="min-w-0 flex-1 basis-48">
                    <p className="truncate font-semibold">{e.user?.name || e.email}</p>
                    <p className="truncate text-body-sm text-ink-3">
                      {e.user ? e.email : "No staff account with this email"} · {e.device}
                      {e.ip && ` · ${e.ip}`}
                    </p>
                  </div>
                  <time dateTime={e.at} className="tabular text-body-sm text-ink-3">
                    {formatDateTime(e.at)}
                  </time>
                </li>
              ))}
            </ul>
            <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />
          </div>
        )}
      </Card>
    </>
  );
}
