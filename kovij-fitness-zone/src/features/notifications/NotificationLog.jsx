import { useState } from "react";
import { Link } from "react-router-dom";
import { BellOff, ShieldCheck } from "lucide-react";
import { useNotificationLog } from "./api";
import { DeliveryBadges, KindBadge } from "./components";
import { NOTIFICATION_KIND, REMINDER_KINDS } from "./labels";
import { Card, CardHeader, DataTable, EmptyState, FilterChips, Pagination, SegmentedControl, Select } from "../../shared/ui";
import { formatDateTime, formatRelativeTime, gymDayKey } from "../../shared/lib/format";

const LIMIT = 20;

const GROUPS = [
  { value: "", label: "Everything" },
  { value: "reminders", label: "Reminders" },
  { value: "announcements", label: "Announcements" },
  { value: "messages", label: "Messages" },
  { value: "other", label: "Other" },
];
const REMINDER_FILTERS = [{ value: "", label: "All reminders" }, ...REMINDER_KINDS.map((k) => ({ value: k, label: NOTIFICATION_KIND[k].label }))];

const PERIODS = [
  { value: "today", label: "Today", days: 0 },
  { value: "7d", label: "Last 7 days", days: 6 },
  { value: "30d", label: "Last 30 days", days: 29 },
  { value: "all", label: "All time", days: null },
];

function periodRange(value) {
  const days = PERIODS.find((p) => p.value === value)?.days;
  if (days == null) return {};
  return { from: gymDayKey(new Date(Date.now() - days * 86_400_000)), to: gymDayKey() };
}

function MemberLink({ member }) {
  if (!member) return <span className="text-ink-3">Member removed</span>;
  return (
    <Link to={`/admin/members/${member._id}`} className="font-semibold text-ink hover:underline">
      {member.name}
    </Link>
  );
}

/**
 * What was sent to members and how each channel went (in app, email, phone), with plain
 * reasons for anything not delivered. `source="reminders"` limits it to automatic reminders.
 */
export default function NotificationLog({ source = "all", title = "Sent log", description }) {
  const [kind, setKind] = useState("");
  const [period, setPeriod] = useState("30d");
  const [show, setShow] = useState("all");
  const [page, setPage] = useState(1);
  const reminders = source === "reminders";

  const params = {
    page,
    limit: LIMIT,
    ...periodRange(period),
    ...(kind && (reminders ? { kind } : { group: kind })),
    ...(show === "problems" && { problems: "true" }),
  };
  const query = useNotificationLog(source, params);
  const withReset = (setter) => (value) => {
    setter(value);
    setPage(1);
  };

  const columns = [
    { id: "when", header: "Sent", cell: (n) => <span className="whitespace-nowrap text-ink-2">{formatDateTime(n.createdAt)}</span> },
    { id: "member", header: "Member", cell: (n) => <MemberLink member={n.member} /> },
    {
      id: "message",
      header: "Message",
      cell: (n) => (
        <div className="min-w-0 max-w-sm">
          <KindBadge kind={n.kind} />
          <p className="mt-1 font-semibold text-ink">{n.title}</p>
          {n.body && <p className="line-clamp-1 text-[13px] text-ink-3">{n.body}</p>}
        </div>
      ),
    },
    { id: "delivery", header: "Delivery", cell: (n) => <DeliveryBadges notification={n} className="flex max-w-xs flex-wrap gap-1.5" /> },
    { id: "by", header: "Sent by", hideBelow: "xl", cell: (n) => <span className="text-ink-3">{n.sentBy || "Automatic"}</span> },
  ];

  const mobileRow = (n) => (
    <div className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <p className="min-w-0 font-semibold text-ink">{n.title}</p>
        <span className="shrink-0 text-[13px] text-ink-3">{formatRelativeTime(n.createdAt)}</span>
      </div>
      <p className="mt-0.5 text-[13px] text-ink-3">
        <MemberLink member={n.member} />, {NOTIFICATION_KIND[n.kind]?.label.toLowerCase() || n.kind}
        {n.sentBy ? `, by ${n.sentBy}` : ""}
      </p>
      <DeliveryBadges notification={n} className="mt-2 flex flex-wrap gap-1.5" />
    </div>
  );

  const empty =
    show === "problems" ? (
      <EmptyState icon={ShieldCheck} title="No delivery problems" body="Everything in this period was delivered, or skipped for a reason shown in the log." compact />
    ) : (
      <EmptyState
        icon={BellOff}
        title="Nothing sent in this period"
        body={reminders ? "Automatic reminders appear here after they go out." : "Reminders, announcements and messages to members appear here."}
        compact
      />
    );

  return (
    <Card padding="none">
      <div className="flex flex-col gap-3 p-4 md:p-5">
        <CardHeader title={title} description={description} className="mb-0" />
        <FilterChips label={reminders ? "Reminder type" : "Message type"} value={kind} onChange={withReset(setKind)} options={reminders ? REMINDER_FILTERS : GROUPS} />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="sm:w-48">
            <Select aria-label="Period" value={period} onChange={(e) => withReset(setPeriod)(e.target.value)}>
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </div>
          <SegmentedControl
            label="Show"
            size="sm"
            value={show}
            onChange={withReset(setShow)}
            options={[
              { value: "all", label: "All" },
              { value: "problems", label: "Only problems" },
            ]}
          />
        </div>
      </div>
      <DataTable
        caption={title}
        columns={columns}
        rows={query.data?.items}
        mobileRow={mobileRow}
        isPending={query.isPending}
        isFetching={query.isFetching && query.isPlaceholderData}
        error={query.error}
        onRetry={() => query.refetch()}
        empty={empty}
      />
      {query.data && <Pagination page={page} limit={LIMIT} total={query.data.total} onPage={setPage} />}
    </Card>
  );
}
