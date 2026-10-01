import { Link } from "react-router-dom";
import { usePermission } from "../auth/permissions";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Inbox,
  IndianRupee,
  LifeBuoy,
  PhoneCall,
  RefreshCw,
  ScanLine,
  UserPlus,
} from "lucide-react";
import { Avatar, ButtonLink, Card, CardHeader, EmptyState } from "../../shared/ui";
import { HourlyCheckins } from "../../shared/ui/charts/charts";
import { cn } from "../../shared/lib/cn";
import {
  formatINR,
  formatNumber,
  formatRelativeDay,
  formatRelativeTime,
  formatShortDate,
  pluralize,
} from "../../shared/lib/format";
import { PAYMENT_TYPE_LABEL } from "../../shared/domain/status";

const WEEKDAY = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", weekday: "long" });
const CURRENT_HOUR = () => Number(new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", hour12: false }).format(new Date()));

function comparisonSentence(today) {
  const hour = CURRENT_HOUR();
  const typicalSoFar = Math.round(today.byHour.filter((h) => h.hour <= hour).reduce((s, h) => s + h.typical, 0));
  if (!today.byHour.some((h) => h.typical > 0)) return "Comparison with a usual day starts after a week of check-ins.";
  const diff = today.checkIns - typicalSoFar;
  const day = WEEKDAY.format(new Date());
  if (Math.abs(diff) <= Math.max(1, typicalSoFar * 0.05)) return `About the same as a usual ${day} by this time.`;
  return `${pluralize(Math.abs(diff), "visit")} ${diff > 0 ? "more" : "fewer"} than a usual ${day} by this time.`;
}

/** The one loud element on the page: live floor count plus today's shape against a usual day. */
export function TodayHero({ today, className }) {
  return (
    <Card tone="hero" padding="lg" className={cn("flex", className)} aria-labelledby="today-hero">
      <div className="flex w-full flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="flex shrink-0 flex-col lg:w-56">
          <h2 id="today-hero" className="text-sm font-semibold text-hero-ink-2">
            Checked in today
          </h2>
          <p className="mt-1 text-display font-bold tracking-[-0.04em]">{formatNumber(today.checkIns)}</p>
          <p className="mt-3 text-sm leading-relaxed text-hero-ink-2">{comparisonSentence(today)}</p>
          <div className="mt-auto pt-5">
            <ButtonLink to="/admin/check-in" variant="primary" icon={ScanLine}>
              Check in a member
            </ButtonLink>
          </div>
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <HourlyCheckins data={today.byHour} onHero className="flex flex-1 flex-col" plotClassName="h-48 lg:h-auto lg:min-h-56 lg:flex-1" />
        </div>
      </div>
    </Card>
  );
}

function ActionRow({ to, icon: Icon, tone, title, detail, count }) {
  const idle = !count;
  return (
    <li>
      <Link
        to={to}
        className={cn(
          "group flex items-center gap-3 rounded-tile px-2 py-2.5 transition-colors hover:bg-surface-2",
          idle && "opacity-60"
        )}
      >
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-[11px]", idle ? "bg-surface-2 text-ink-3" : tone)}>
          <Icon className="size-[18px]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block truncate text-[13px] text-ink-3">{idle ? "Nothing right now" : detail}</span>
        </span>
        <span className="tabular text-lg font-bold text-ink">{formatNumber(count || 0)}</span>
        <ChevronRight className="size-4 text-ink-3 transition-transform group-hover:translate-x-0.5" aria-hidden />
      </Link>
    </li>
  );
}

/** Work queue: each row is a count that links straight to the list that clears it. */
export function NeedsAttention({ data, className }) {
  const canRenew = usePermission("renewals.view");
  const within = [7, 15, 30].includes(data.expiring.windowDays) ? data.expiring.windowDays : 7;
  return (
    <Card className={className} aria-labelledby="needs-attention">
      <CardHeader id="needs-attention" title="Needs attention" description="Tap a row to work through it." />
      <ul className="-mx-2 flex flex-col gap-0.5">
        {data.dues && (
          <ActionRow
            to="/admin/payments?status=pending"
            icon={IndianRupee}
            tone="bg-warn-soft text-warn"
            title="Dues to collect"
            detail={`${formatINR(data.dues.amount)} outstanding`}
            count={data.dues.count}
          />
        )}
        <ActionRow
          to={canRenew ? `/admin/renewals?view=ending&within=${within}` : "/admin/members?state=expiring"}
          icon={CalendarClock}
          tone="bg-brand-soft text-brand-ink"
          title={`Plans ending in ${data.expiring.windowDays} days`}
          detail="Not renewed yet"
          count={data.expiring.count}
        />
        <ActionRow
          to="/admin/members?state=expired"
          icon={CircleAlert}
          tone="bg-bad-soft text-bad"
          title="Lapsed in the last 2 weeks"
          detail="Call to win them back"
          count={data.lapsed.count}
        />
        <ActionRow
          to="/admin/leads?due=today"
          icon={PhoneCall}
          tone="bg-info-soft text-info"
          title="Follow-ups due"
          detail="Leads waiting for a call"
          count={data.leads.followUpsDue}
        />
        <ActionRow
          to="/admin/leads?status=new"
          icon={Inbox}
          tone="bg-info-soft text-info"
          title="New enquiries"
          detail="From the website and walk-ins"
          count={data.leads.new}
        />
        {data.support && (
          <ActionRow to="/admin/support" icon={LifeBuoy} tone="bg-brand-soft text-brand-ink" title="Member questions" detail="Sent from the app, waiting for you" count={data.support.unread} />
        )}
      </ul>
    </Card>
  );
}

export function EndingSoon({ expiring, className }) {
  return (
    <Card className={className} aria-labelledby="ending-soon">
      <CardHeader
        id="ending-soon"
        title="Ending soon"
        description={`Plans that end in the next ${expiring.windowDays} days`}
        action={
          expiring.count > 0 && (
            <Link to="/admin/members?state=expiring" className="text-sm font-semibold text-brand-ink hover:underline">
              See all {formatNumber(expiring.count)}
            </Link>
          )
        }
      />
      {expiring.items.length === 0 ? (
        <EmptyState compact icon={CalendarClock} title="No plans end this week" body="Members whose plans end soon will show up here for a quick renewal." />
      ) : (
        <ul className="-mx-2 flex flex-col">
          {expiring.items.map((m) => (
            <li key={m.membershipId} className="flex items-center gap-3 rounded-tile px-2 py-2 hover:bg-surface-2">
              <Avatar name={m.name} src={m.photo} size="md" />
              <Link to={`/admin/members/${m.memberId}`} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-ink">{m.name}</span>
                <span className="block truncate text-[13px] text-ink-3">
                  {m.planName}, ends {formatShortDate(m.endDate)} ({formatRelativeDay(m.endDate)})
                </span>
              </Link>
              <ButtonLink to={`/admin/members/${m.memberId}?action=renew`} size="sm" variant="quiet" icon={RefreshCw}>
                Renew
              </ButtonLink>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const ACTIVITY = {
  payment: { icon: IndianRupee, text: (a) => `paid${a.amount != null ? ` ${formatINR(a.amount)}` : ""} for ${(PAYMENT_TYPE_LABEL[a.paymentType] || "a plan").toLowerCase()}` },
  join: { icon: UserPlus, text: (a) => (a.source === "google" ? "signed up online" : "was registered at the desk") },
  renew: { icon: RefreshCw, text: (a) => `renewed ${a.planName}` },
  upgrade: { icon: ArrowUpRight, text: (a) => `upgraded to ${a.planName}` },
  downgrade: { icon: ArrowDownRight, text: (a) => `switched to ${a.planName}` },
};

export function RecentActivity({ items, className }) {
  return (
    <Card className={className} aria-labelledby="recent-activity">
      <CardHeader id="recent-activity" title="Recent activity" />
      {items.length === 0 ? (
        <EmptyState compact icon={RefreshCw} title="No activity yet" body="Payments, new members and renewals will appear here as they happen." />
      ) : (
        <ol className="flex flex-col">
          {items.map((a, i) => {
            const meta = ACTIVITY[a.kind] || ACTIVITY.join;
            return (
              <li key={`${a.kind}-${a.memberId}-${i}`} className="flex gap-3 py-2">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                  <meta.icon className="size-4" aria-hidden />
                </span>
                <p className="min-w-0 flex-1 text-sm text-ink-2">
                  <Link to={`/admin/members/${a.memberId}`} className="font-semibold text-ink hover:underline">
                    {a.memberName}
                  </Link>{" "}
                  {meta.text(a)}
                  <span className="block text-[13px] text-ink-3">{formatRelativeTime(a.at)}</span>
                </p>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
