import { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowUpRight, CalendarCheck, CalendarClock, History, MessageCircle, Phone, RefreshCw, UserX } from "lucide-react";
import { useEndingPlans, useLapsedMembers, useRenewalHistory } from "./api";
import { SellPlanDialog } from "../members/SellPlanDialog";
import { MemberStateBadge, PlanStatusBadge } from "../members/StatusBadges";
import { usePermission } from "../auth/permissions";
import { useSettings } from "../settings/api";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { Avatar, Badge, Button, Card, DataTable, EmptyState, FilterChips, PageHeader, Pagination, SegmentedControl, TabPanel, Tabs } from "../../shared/ui";
import { formatDate, formatINR, formatPhone, formatRelativeDay, phoneHref } from "../../shared/lib/format";

const DEFAULTS = { view: "ending", within: 7, since: 60, type: "all", range: 30, page: 1 };
const LIMIT = 25;

const WINDOWS = [7, 15, 30];
const LAPSED_RANGES = [
  { value: 30, label: "Last 30 days" },
  { value: 60, label: "Last 60 days" },
  { value: 180, label: "Last 6 months" },
];
const HISTORY_TYPES = [
  { value: "all", label: "All" },
  { value: "renew", label: "Renewals" },
  { value: "upgrade", label: "Upgrades" },
  { value: "downgrade", label: "Downgrades" },
];
const HISTORY_RANGES = [
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
  { value: 365, label: "1 year" },
];

const firstName = (name) => String(name || "").split(" ")[0] || "there";

/** WhatsApp link with a ready-to-send message the desk can edit before sending. */
function whatsappLink(member, text) {
  const base = phoneHref(member.phone, "whatsapp");
  return base ? `${base}?text=${encodeURIComponent(text)}` : null;
}

function ContactButtons({ member, message }) {
  const tel = phoneHref(member.phone);
  const wa = whatsappLink(member, message);
  return (
    <>
      {tel && (
        <a href={tel} aria-label={`Call ${member.name}`} title={`Call ${formatPhone(member.phone)}`} className="inline-grid size-11 shrink-0 place-items-center rounded-control border border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink md:size-10">
          <Phone className="size-[18px]" aria-hidden />
        </a>
      )}
      {wa && (
        <a href={wa} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${member.name}`} title="Send a WhatsApp message" className="inline-grid size-11 shrink-0 place-items-center rounded-control border border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink md:size-10">
          <MessageCircle className="size-[18px]" aria-hidden />
        </a>
      )}
    </>
  );
}

function MemberCell({ member, sub }) {
  return (
    <Link to={`/admin/members/${member._id}`} className="flex min-w-0 items-center gap-3">
      <Avatar name={member.name} src={member.profilePhoto} />
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink hover:underline">{member.name}</span>
        <span className="block truncate text-body-sm text-ink-3">{sub || member.memberCode || formatPhone(member.phone)}</span>
      </span>
    </Link>
  );
}

function daysLeftLabel(n) {
  if (n <= 0) return "Ends today";
  if (n === 1) return "Ends tomorrow";
  return `${n} days left`;
}

function EndingSoon({ filters, setFilters, onRenew, canSell, canSeeMoney, gymName }) {
  const query = useEndingPlans({ within: filters.within, page: filters.page, limit: LIMIT });
  const data = query.data;
  const message = (r) =>
    `Hi ${firstName(r.member.name)}, your ${r.membership.planName} plan at ${gymName} ends on ${formatDate(r.membership.endDate)}. Renew at the front desk or reply here and we'll keep it going without a break.`;

  const actions = (r) => (
    <div className="flex items-center justify-end gap-2">
      <ContactButtons member={r.member} message={message(r)} />
      {canSell && (
        <Button variant="primary" icon={RefreshCw} onClick={() => onRenew(r)}>
          Renew
        </Button>
      )}
    </div>
  );

  const columns = [
    { id: "member", header: "Member", cell: (r) => <MemberCell member={r.member} /> },
    {
      id: "plan",
      header: "Plan",
      cell: (r) => (
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-ink-2">{r.membership.planName}</span>
          {r.membership.status === "paused" && <PlanStatusBadge status="paused" size="sm" />}
        </span>
      ),
    },
    {
      id: "ends",
      header: "Ends",
      cell: (r) => (
        <span className="whitespace-nowrap">
          <span className="text-ink">{formatDate(r.membership.endDate)}</span>
          <span className={`block text-body-sm ${r.daysLeft <= 2 ? "font-semibold text-warn" : "text-ink-3"}`}>{daysLeftLabel(r.daysLeft)}</span>
        </span>
      ),
    },
    canSeeMoney && { id: "dues", header: "Dues", align: "right", hideBelow: "lg", cell: (r) => (r.dues > 0 ? <span className="font-semibold text-warn">{formatINR(r.dues)}</span> : <span className="text-ink-3">—</span>) },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: actions },
  ].filter(Boolean);

  const mobileRow = (r) => (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <MemberCell member={r.member} sub={r.membership.planName} />
        </div>
        <Badge tone={r.daysLeft <= 2 ? "warn" : "neutral"} icon={CalendarClock} size="sm">
          {daysLeftLabel(r.daysLeft)}
        </Badge>
      </div>
      {actions(r)}
    </div>
  );

  return (
    <>
      <FilterChips
        label="Ending within"
        className="mb-4"
        value={String(filters.within)}
        onChange={(w) => setFilters({ within: Number(w) })}
        options={WINDOWS.map((d) => ({ value: String(d), label: `Next ${d} days`, count: data?.counts?.[d] }))}
      />
      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Plans ending soon"
          columns={columns}
          rows={data?.items}
          getRowId={(r) => r.membership._id}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={
            <EmptyState
              icon={CalendarCheck}
              title={`No plans ending in the next ${filters.within} days`}
              body={filters.within < 30 ? "Everyone in this window has renewed. Look further ahead to call people early." : "Nobody's plan ends in the next month without a renewal."}
              action={filters.within < 30 && <Button variant="secondary" onClick={() => setFilters({ within: 30 })}>Show the next 30 days</Button>}
            />
          }
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>
    </>
  );
}

function Lapsed({ filters, setFilters, onRenew, canSell, canSeeMoney, gymName }) {
  const query = useLapsedMembers({ since: filters.since, page: filters.page, limit: LIMIT });
  const data = query.data;
  const message = (r) =>
    `Hi ${firstName(r.member.name)}, we miss you at ${gymName}! Your ${r.membership.planName} plan ended on ${formatDate(r.membership.endDate)}. Reply here or drop by the front desk to start again.`;

  const actions = (r) => (
    <div className="flex items-center justify-end gap-2">
      <ContactButtons member={r.member} message={message(r)} />
      {canSell && (
        <Button variant="primary" icon={RefreshCw} onClick={() => onRenew(r)}>
          Renew
        </Button>
      )}
    </div>
  );

  const endedLabel = (r) => (r.membership.status === "cancelled" ? `Cancelled ${formatRelativeDay(r.membership.endDate)}` : `Ended ${formatRelativeDay(r.membership.endDate)}`);

  const columns = [
    { id: "member", header: "Member", cell: (r) => <MemberCell member={r.member} /> },
    { id: "plan", header: "Last plan", cell: (r) => <span className="text-ink-2">{r.membership.planName}</span> },
    {
      id: "ended",
      header: "Ended",
      cell: (r) => (
        <span className="whitespace-nowrap">
          <span className="text-ink">{formatDate(r.membership.endDate)}</span>
          <span className="block text-body-sm text-ink-3">{endedLabel(r)}</span>
        </span>
      ),
    },
    canSeeMoney && { id: "dues", header: "Dues", align: "right", hideBelow: "lg", cell: (r) => (r.dues > 0 ? <span className="font-semibold text-warn">{formatINR(r.dues)}</span> : <span className="text-ink-3">—</span>) },
    { id: "actions", header: <span className="sr-only">Actions</span>, align: "right", cell: actions },
  ].filter(Boolean);

  const mobileRow = (r) => (
    <div className="flex flex-col gap-3 px-4 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <MemberCell member={r.member} sub={`${r.membership.planName}, ${endedLabel(r).toLowerCase()}`} />
        </div>
        <MemberStateBadge status="expired" size="sm" />
      </div>
      {actions(r)}
    </div>
  );

  return (
    <>
      <FilterChips label="Plan ended in" className="mb-4" value={String(filters.since)} onChange={(s) => setFilters({ since: Number(s) })} options={LAPSED_RANGES.map((r) => ({ value: String(r.value), label: r.label }))} />
      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Lapsed members"
          columns={columns}
          rows={data?.items}
          getRowId={(r) => r.member._id}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={<EmptyState icon={UserX} title="No lapsed members in this period" body="Members whose plan ended without a renewal show up here, so you can invite them back." />}
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>
    </>
  );
}

function changeLabel(r) {
  if (r.type === "upgrade") return { icon: ArrowUpRight, text: r.fromPlanName ? `${r.fromPlanName} to ${r.planName}` : `Upgraded to ${r.planName}`, badge: "Upgrade", tone: "good" };
  if (r.type === "downgrade") return { icon: ArrowDownRight, text: r.fromPlanName ? `${r.fromPlanName} to ${r.planName}` : `Changed to ${r.planName}`, badge: "Downgrade", tone: "neutral" };
  return { icon: RefreshCw, text: r.planName, badge: "Renewal", tone: "info" };
}

function RenewalHistory({ filters, setFilters, canSeeMoney }) {
  const query = useRenewalHistory({ type: filters.type, since: filters.range, page: filters.page, limit: LIMIT });
  const data = query.data;

  const columns = [
    { id: "date", header: "Date", cell: (r) => <span className="whitespace-nowrap">{formatDate(r.at)}</span> },
    { id: "member", header: "Member", cell: (r) => <MemberCell member={r.member} /> },
    {
      id: "change",
      header: "Change",
      cell: (r) => {
        const c = changeLabel(r);
        return (
          <span className="flex flex-col gap-1">
            <Badge tone={c.tone} icon={c.icon} size="sm" className="self-start">
              {c.badge}
            </Badge>
            <span className="text-ink-2">{c.text}</span>
          </span>
        );
      },
    },
    canSeeMoney && { id: "amount", header: "Amount", align: "right", cell: (r) => (r.amount != null ? <span className="font-semibold">{formatINR(r.amount)}</span> : "—") },
    { id: "by", header: "By", hideBelow: "lg", cell: (r) => <span className="text-ink-2">{r.by || "—"}</span> },
    { id: "status", header: "Plan status", hideBelow: "md", cell: (r) => <PlanStatusBadge status={r.status} size="sm" /> },
  ].filter(Boolean);

  const mobileRow = (r) => {
    const c = changeLabel(r);
    return (
      <div className="flex items-start gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <MemberCell member={r.member} sub={`${c.badge}: ${c.text}`} />
          <p className="mt-1.5 pl-[52px] text-body-sm text-ink-3">
            {formatDate(r.at)}
            {r.by ? `, by ${r.by}` : ""}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          {canSeeMoney && r.amount != null && <span className="font-semibold">{formatINR(r.amount)}</span>}
          <PlanStatusBadge status={r.status} size="sm" />
        </div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <FilterChips label="Kind of change" value={filters.type} onChange={(type) => setFilters({ type })} options={HISTORY_TYPES} />
        <SegmentedControl label="Period" size="sm" value={String(filters.range)} onChange={(v) => setFilters({ range: Number(v) })} options={HISTORY_RANGES.map((r) => ({ value: String(r.value), label: r.label }))} />
      </div>
      <Card padding="none" className="overflow-hidden">
        <DataTable
          caption="Renewal history"
          columns={columns}
          rows={data?.items}
          mobileRow={mobileRow}
          isPending={query.isPending}
          isFetching={query.isFetching && query.isPlaceholderData}
          error={query.error}
          onRetry={() => query.refetch()}
          empty={<EmptyState icon={History} title="No renewals in this period" body="Renewals and plan changes made at the desk or requested in the app are listed here." />}
        />
        {data && <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />}
      </Card>
    </>
  );
}

export default function RenewalsPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const canSell = usePermission("memberships.sell");
  const canSeeMoney = usePermission("payments.view");
  const settings = useSettings();
  const gymName = settings.data?.gymName || "the gym";
  const [renewing, setRenewing] = useState(null);

  const props = { filters, setFilters, onRenew: setRenewing, canSell, canSeeMoney, gymName };
  return (
    <>
      <PageHeader title="Renewals" description="Call members before their plan ends, win back lapsed ones, and see what's been renewed." />
      <Tabs
        label="Renewals"
        value={filters.view}
        onChange={(view) => setFilters({ view, page: 1 })}
        className="mb-4"
        tabs={[
          { value: "ending", label: "Ending soon" },
          { value: "lapsed", label: "Lapsed" },
          { value: "history", label: "History" },
        ]}
      />
      <TabPanel value={filters.view}>
        {filters.view === "lapsed" ? <Lapsed {...props} /> : filters.view === "history" ? <RenewalHistory {...props} /> : <EndingSoon {...props} />}
      </TabPanel>
      {canSell && (
        <SellPlanDialog
          open={Boolean(renewing)}
          onClose={() => setRenewing(null)}
          member={renewing?.member}
          // The row carries the plan in question; the lists only include members with nothing else waiting.
          memberships={renewing ? [renewing.membership] : []}
        />
      )}
    </>
  );
}
