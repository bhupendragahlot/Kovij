import { useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, Download, Footprints, MessageCircle, Phone, RefreshCcw, UserPlus, Users } from "lucide-react";
import { PERIODS, periodDates, useNotComingIn, useReportOverview } from "./api";
import { BusyHeatmap, JoinsChart, RenewalTrendChart, VisitsChart } from "./charts";
import { DAY_SHORT, hourLabel } from "./labels";
import { downloadCsv } from "../payments/api";
import { REFERRAL_CHANNEL_LABEL } from "../members/memberStatus";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { Avatar, Button, Card, CardHeader, EmptyState, ErrorState, Field, Input, KpiTile, PageHeader, Pagination, SegmentedControl, Select, Skeleton, useToast } from "../../shared/ui";
import { LEAD_SOURCE_LABEL, LEAD_STATUS } from "../../shared/domain/status";
import { formatDate, formatINR, formatNumber, formatPhone, gymDayKey, phoneHref, pluralize } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

const DEFAULTS = { range: "30d", from: "", to: "", days: 14, page: 1 };

const MEMBER_SOURCE = { desk: "Added at the desk", lead: "From an enquiry", google: "Signed up online", app: "Signed up in the app" };
const OUTCOMES = [
  { key: "on_time", label: "Renewed on time", color: "var(--kv-good)" },
  { key: "late", label: "Renewed late", color: "var(--kv-chart-1)" },
  { key: "undecided", label: "Still deciding", color: "var(--kv-line-strong)" },
  { key: "lost", label: "Didn’t renew", color: "var(--kv-bad)" },
];

const periodText = (p) => `${formatDate(`${p.from}T12:00:00+05:30`)} to ${formatDate(`${p.to}T12:00:00+05:30`)}`;

/** OWNER: reports & dashboard module. /admin/reports (owners and managers). */
export default function ReportsPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const { from, to } = periodDates(filters.range, filters);
  const query = useReportOverview({ from, to, days: filters.days });
  const data = query.data;

  return (
    <>
      <PageHeader title="Reports" description={data ? `${periodText(data.period)}, compared with the ${pluralize(data.period.days, "day")} before` : "How the gym is doing: members, renewals, visits and enquiries."} />
      <PeriodPicker filters={filters} setFilters={setFilters} from={from} to={to} />

      {query.isPending ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5" role="status" aria-label="Loading reports">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32 rounded-card" />
          ))}
          <Skeleton className="col-span-2 h-80 rounded-card lg:col-span-5" />
        </div>
      ) : query.isError && !data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : (
        <div className={cn("flex flex-col gap-4 transition-opacity duration-200", query.isFetching && query.isPlaceholderData && "opacity-60")}>
          <Headlines data={data} />
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <RenewalsCard renewals={data.renewals} period={data.period} />
            <JoinsCard members={data.members} />
            <AttendanceCard attendance={data.attendance} period={data.period} />
            <NotComingInCard filters={filters} setFilters={setFilters} />
            <PlansCard plans={data.plans} />
            <EnquiriesCard enquiries={data.enquiries} />
          </div>
        </div>
      )}
    </>
  );
}

function PeriodPicker({ filters, setFilters, from, to }) {
  return (
    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end">
      <label className="flex flex-col gap-1.5 lg:hidden">
        <span className="text-[13px] font-semibold text-ink-3">Period</span>
        <Select value={filters.range} onChange={(e) => setFilters({ range: e.target.value })}>
          {PERIODS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </label>
      <SegmentedControl label="Period" value={filters.range} onChange={(range) => setFilters({ range })} options={PERIODS} className="max-lg:hidden" />
      {filters.range === "custom" && (
        <div className="grid grid-cols-2 gap-3 sm:w-80">
          <Field label="From">
            <Input type="date" value={from} max={to} onChange={(e) => setFilters({ from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} min={from} max={gymDayKey()} onChange={(e) => setFilters({ to: e.target.value })} />
          </Field>
        </div>
      )}
    </div>
  );
}

function Headlines({ data }) {
  const { members, renewals, attendance, enquiries } = data;
  const prevLabel = "the period before";
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
      <KpiTile
        label="Active members"
        icon={Users}
        to="/admin/members?state=active"
        value={formatNumber(members.activeNow)}
        sub={members.frozenNow ? `${formatNumber(members.frozenNow)} more on a frozen plan` : "Right now"}
      />
      <KpiTile label="New members" icon={UserPlus} value={formatNumber(members.joined)} delta={{ current: members.joined, previous: members.joinedPrev, label: prevLabel }} />
      <KpiTile
        label="Renewal rate"
        icon={RefreshCcw}
        to="/admin/renewals?view=history"
        value={renewals.rate == null ? "Not yet" : `${renewals.rate}%`}
        sub={renewals.ended ? `Of ${pluralize(renewals.ended, "plan")} that ended` : "No plans ended in this period"}
      />
      <KpiTile label="Visits" icon={Footprints} value={formatNumber(attendance.visits)} delta={{ current: attendance.visits, previous: attendance.visitsPrev, label: prevLabel }} />
      <KpiTile
        label="Enquiries"
        icon={MessageCircle}
        to="/admin/leads"
        value={formatNumber(enquiries.total)}
        sub={enquiries.conversionRate == null ? "None in this period" : `${enquiries.conversionRate}% have joined`}
        className="col-span-2 lg:col-span-1"
      />
    </div>
  );
}

function OutcomeBar({ summary }) {
  const total = summary.ended || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        {OUTCOMES.map((o) => (summary[o.key] ? <span key={o.key} style={{ width: `${(summary[o.key] / total) * 100}%`, background: o.color }} /> : null))}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-4">
        {OUTCOMES.map((o) => (
          <li key={o.key} className="flex items-start gap-2">
            <span className="mt-1.5 size-2.5 shrink-0 rounded-[3px]" style={{ background: o.color }} aria-hidden />
            <span>
              <span className="tabular block font-bold">{formatNumber(summary[o.key])}</span>
              <span className="text-[13px] text-ink-3">{o.label}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RenewalsCard({ renewals, period }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv("/admin/reports/renewals.csv", { from: period.from, to: period.to }, `renewals-${period.from}-to-${period.to}.csv`);
    } catch (e) {
      toast.error("Couldn't export", { description: e.message });
    } finally {
      setExporting(false);
    }
  };
  return (
    <Card padding="lg" className="xl:col-span-2">
      <CardHeader
        title="Renewals"
        description={`Plans that ended in this period, and whether the member renewed within ${renewals.graceDays} days.`}
        action={
          <Button size="sm" icon={Download} onClick={exportCsv} loading={exporting} disabled={!renewals.ended}>
            Export
          </Button>
        }
      />
      {renewals.ended === 0 ? (
        <p className="mb-6 text-sm text-ink-3">No plans ended in this period.</p>
      ) : (
        <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_20rem]">
          <OutcomeBar summary={renewals} />
          {renewals.byPlan.length > 0 && (
            <table className="w-full text-sm">
              <caption className="sr-only">Renewals by plan</caption>
              <thead>
                <tr className="border-b border-line text-[13px] text-ink-3">
                  <th scope="col" className="py-1.5 text-left font-semibold">
                    Plan
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    Ended
                  </th>
                  <th scope="col" className="py-1.5 text-right font-semibold">
                    Renewed
                  </th>
                </tr>
              </thead>
              <tbody>
                {renewals.byPlan.slice(0, 6).map((p) => (
                  <tr key={p.planName} className="border-b border-line/60 last:border-0">
                    <td className="max-w-40 truncate py-1.5">{p.planName}</td>
                    <td className="tabular py-1.5 text-right">{formatNumber(p.ended)}</td>
                    <td className="tabular py-1.5 text-right font-semibold">{p.rate == null ? "Not yet" : `${p.rate}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
      <RenewalTrendChart data={renewals.byMonth} />
    </Card>
  );
}

function BreakdownList({ items, total, emptyText }) {
  if (!items.length) return <p className="text-sm text-ink-3">{emptyText}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {items.map((i) => (
        <li key={i.key}>
          <div className="mb-1 flex justify-between gap-3 text-sm">
            <span className="truncate">{i.label}</span>
            <span className="tabular shrink-0 font-semibold">
              {formatNumber(i.count)}
              {i.extra && <span className="ml-1.5 font-normal text-ink-3">{i.extra}</span>}
            </span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-2" aria-hidden>
            <div className="h-full rounded-full bg-[var(--kv-chart-1)]" style={{ width: `${Math.max(2, (i.count / (total || 1)) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function JoinsCard({ members }) {
  const channels = members.byChannel.map((c) => ({ key: c.channel, label: c.channel === "unknown" ? "Not asked" : REFERRAL_CHANNEL_LABEL[c.channel] || c.channel, count: c.count }));
  const sources = members.bySource.map((s) => ({ key: s.source, label: MEMBER_SOURCE[s.source] || s.source, count: s.count }));
  return (
    <Card padding="lg">
      <CardHeader title="New members" description={`${pluralize(members.joined, "member")} joined in this period.`} />
      <JoinsChart data={members.joinsByMonth} />
      <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">How they heard about us</h3>
          <BreakdownList items={channels} total={members.joined} emptyText="No new members in this period." />
        </div>
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">How they signed up</h3>
          <BreakdownList items={sources} total={members.joined} emptyText="No new members in this period." />
        </div>
      </div>
    </Card>
  );
}

function AttendanceCard({ attendance, period }) {
  const b = attendance.busiest;
  return (
    <Card padding="lg">
      <CardHeader
        title="Visits"
        description={
          attendance.visits
            ? `${pluralize(attendance.visitors, "member")} came in, ${attendance.visitsPerVisitor} times each on average.${b ? ` Busiest: ${DAY_SHORT[b.day]} around ${hourLabel(b.hour)}m.` : ""}`
            : "No visits in this period."
        }
      />
      <VisitsChart byDay={attendance.byDay} from={period.from} to={period.to} />
      <div className="mt-6">
        <BusyHeatmap grid={attendance.heatmap} />
      </div>
    </Card>
  );
}

const DAY_OPTIONS = [
  { value: "14", label: "14 days" },
  { value: "21", label: "21 days" },
  { value: "30", label: "30 days" },
];

function NotComingInCard({ filters, setFilters }) {
  const toast = useToast();
  const [exporting, setExporting] = useState(false);
  const query = useNotComingIn({ days: filters.days, page: filters.page, limit: 10 });
  const data = query.data;
  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadCsv("/admin/reports/not-coming-in.csv", { days: filters.days }, `not-coming-in-${filters.days}-days.csv`);
    } catch (e) {
      toast.error("Couldn't export", { description: e.message });
    } finally {
      setExporting(false);
    }
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div className="p-5 pb-0 md:p-6 md:pb-0">
        <CardHeader
          title="Not coming in"
          description="Paying members who haven’t visited lately. A call now keeps them from quietly lapsing."
          action={
            <Button size="sm" icon={Download} onClick={exportCsv} loading={exporting} disabled={!data?.total}>
              Export
            </Button>
          }
        />
        <SegmentedControl label="No visit for" size="sm" value={String(filters.days)} onChange={(days) => setFilters({ days: Number(days) })} options={DAY_OPTIONS} className="mb-3" />
      </div>
      {query.isPending ? (
        <div className="flex flex-col gap-2 p-5">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
      ) : !data.total ? (
        <EmptyState compact icon={CalendarCheck} title="Everyone’s coming in" body={`Every member on a current plan has visited in the last ${filters.days} days.`} />
      ) : (
        <>
          <p className="px-5 pb-2 text-[13px] font-semibold text-ink-3 md:px-6">{pluralize(data.total, "member")}</p>
          <ul className="divide-y divide-line border-t border-line">
            {data.items.map((m) => (
              <li key={m.memberId} className="flex items-center gap-3 px-5 py-3 md:px-6">
                <Avatar name={m.name} src={m.photo} />
                <div className="min-w-0 flex-1">
                  <Link to={`/admin/members/${m.memberId}`} className="block truncate font-semibold hover:underline">
                    {m.name}
                  </Link>
                  <p className="truncate text-[13px] text-ink-3">
                    {m.lastVisit ? `Last came ${pluralize(m.daysAway, "day")} ago` : "Hasn’t come since the plan started"} · {m.planName}
                    {m.trainer && ` · ${m.trainer}`}
                  </p>
                </div>
                <ContactLinks member={m} />
              </li>
            ))}
          </ul>
          <Pagination page={filters.page} limit={10} total={data.total} onPage={(page) => setFilters({ page })} />
        </>
      )}
    </Card>
  );
}

const contactClass = "inline-grid size-11 shrink-0 place-items-center rounded-control border border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink md:size-10";

/** Call and WhatsApp (with a friendly check-in message the desk can edit before sending). */
function ContactLinks({ member }) {
  const tel = phoneHref(member.phone);
  const wa = phoneHref(member.phone, "whatsapp");
  if (!tel) return null;
  const text = `Hi ${member.name.split(" ")[0]}, we haven't seen you at the gym in a while. Everything okay? Your plan is still running, come in any time.`;
  return (
    <div className="flex shrink-0 gap-1.5">
      <a href={tel} aria-label={`Call ${member.name}`} title={`Call ${formatPhone(member.phone)}`} className={contactClass}>
        <Phone className="size-[18px]" aria-hidden />
      </a>
      <a href={`${wa}?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${member.name}`} title="Send a WhatsApp message" className={contactClass}>
        <MessageCircle className="size-[18px]" aria-hidden />
      </a>
    </div>
  );
}

function PlansCard({ plans }) {
  const totalSold = plans.sold.reduce((s, p) => s + p.amount, 0);
  const totalMembers = plans.current.reduce((s, p) => s + p.members, 0);
  return (
    <Card padding="lg">
      <CardHeader title="Plans" description="Which plans sell, and what members are on now." />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">Sold in this period</h3>
          <BreakdownList items={plans.sold.map((p) => ({ key: p.planName, label: p.planName, count: p.sold, extra: formatINR(p.amount) }))} total={Math.max(...plans.sold.map((p) => p.sold), 1)} emptyText="No plans paid for in this period." />
          {totalSold > 0 && <p className="mt-3 text-[13px] text-ink-3">{formatINR(totalSold)} collected for plans</p>}
        </div>
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">Members on each plan now</h3>
          <BreakdownList items={plans.current.map((p) => ({ key: p.planName, label: p.planName, count: p.members }))} total={totalMembers} emptyText="No one is on a plan right now." />
        </div>
      </div>
    </Card>
  );
}

function EnquiriesCard({ enquiries }) {
  return (
    <Card padding="lg">
      <CardHeader
        title="Enquiries"
        description={enquiries.total ? `${pluralize(enquiries.total, "enquiry", "enquiries")}, ${formatNumber(enquiries.won)} joined so far. Likely spam left out.` : "No enquiries in this period."}
        action={
          <Link to="/admin/leads" className="text-[13px] font-semibold text-brand-ink hover:underline">
            Open enquiries
          </Link>
        }
      />
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">Where they came from</h3>
          <BreakdownList
            items={enquiries.bySource.map((s) => ({ key: s.source, label: LEAD_SOURCE_LABEL[s.source] || s.source, count: s.count, extra: s.won ? `${s.won} joined` : "" }))}
            total={enquiries.total}
            emptyText="Nothing yet."
          />
        </div>
        <div>
          <h3 className="mb-3 text-[13px] font-bold text-ink-3">Where they are now</h3>
          <BreakdownList
            items={Object.entries(LEAD_STATUS)
              .map(([k, s]) => ({ key: k, label: s.label, count: enquiries.byStatus[k] || 0 }))
              .filter((i) => i.count)}
            total={enquiries.total}
            emptyText="Nothing yet."
          />
          {enquiries.lostReasons.length > 0 && (
            <>
              <h3 className="mb-2 mt-5 text-[13px] font-bold text-ink-3">Why people didn’t join</h3>
              <ul className="flex flex-col gap-1 text-sm">
                {enquiries.lostReasons.map((r) => (
                  <li key={r.reason} className="flex justify-between gap-3">
                    <span className="truncate first-letter:uppercase">{r.reason}</span>
                    <span className="tabular font-semibold">{formatNumber(r.count)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

