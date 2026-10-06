import { ArrowDownRight, ArrowUpRight, Ban, CalendarPlus, Flag, History, PauseCircle, PlayCircle, RefreshCw, UserPlus } from "lucide-react";
import { useMemberTimeline } from "./api";
import { PlanStatusBadge } from "./StatusBadges";
import { dayWord } from "./planDates";
import { EmptyState, ErrorState, Skeleton } from "../../shared/ui";
import { formatDate, formatINR } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

/** Title, icon and tone for each kind of event (server: PlanHistory.changeType, plus "ended"). */
function describe(e) {
  switch (e.type) {
    case "join":
      return { icon: UserPlus, tone: "good", title: `Joined on ${e.planName || "a plan"}` };
    case "renew":
      return { icon: RefreshCw, tone: "good", title: `Renewed ${e.planName}` };
    case "upgrade":
      return { icon: ArrowUpRight, tone: "good", title: e.fromPlanName ? `Upgraded from ${e.fromPlanName} to ${e.planName}` : `Upgraded to ${e.planName}` };
    case "downgrade":
      return { icon: ArrowDownRight, tone: "neutral", title: e.fromPlanName ? `Changed from ${e.fromPlanName} to ${e.planName}` : `Changed to ${e.planName}` };
    case "freeze":
      return { icon: PauseCircle, tone: "info", title: `Frozen for ${dayWord(e.days)}` };
    case "unfreeze":
      if (e.source === "system") return { icon: PlayCircle, tone: "info", title: `Freeze ended after ${dayWord(e.days)}` };
      return e.days > 0 ? { icon: PlayCircle, tone: "info", title: `Unfrozen after ${dayWord(e.days)}` } : { icon: PlayCircle, tone: "neutral", title: "Freeze removed before it started" };
    case "extend":
      return { icon: CalendarPlus, tone: "good", title: `${dayWord(e.days)} added` };
    case "cancel":
      return { icon: Ban, tone: "bad", title: `${e.planName || "Plan"} cancelled` };
    case "ended":
      return { icon: Flag, tone: "neutral", title: `${e.planName} ended` };
    default:
      return { icon: History, tone: "neutral", title: e.type };
  }
}

const TONES = { good: "bg-good-soft text-good", info: "bg-info-soft text-info", bad: "bg-bad-soft text-bad", neutral: "bg-surface-2 text-ink-2" };
const SALES = ["join", "renew", "upgrade", "downgrade"];

function detailLine(e) {
  const parts = [];
  if (SALES.includes(e.type) && e.from && e.to) parts.push(`${formatDate(e.from)} to ${formatDate(e.to)}`);
  if (e.type === "freeze" && e.from && e.to) parts.push(`On hold ${formatDate(e.from)}, back on ${formatDate(e.to)}`);
  if (e.type === "extend" && e.to) parts.push(`Now ends ${formatDate(e.to)}`);
  if (e.amount != null) parts.push(formatINR(e.amount));
  if (e.by) parts.push(`by ${e.by}`);
  return parts.join(" · ");
}

/** Every change to a member's plans, newest first: joins, renewals, plan changes, freezes, extra days, cancellations. */
export function MembershipTimeline({ memberId }) {
  const timeline = useMemberTimeline(memberId);

  if (timeline.isPending) {
    return (
      <div className="flex flex-col gap-5 p-4 md:p-5" role="status" aria-label="Loading history">
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="size-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/2" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }
  if (timeline.isError) return <ErrorState compact error={timeline.error} onRetry={() => timeline.refetch()} title="History didn't load" />;
  if (!timeline.data.length) {
    return <EmptyState compact icon={History} title="No history yet" body="Plans sold, renewals, freezes and extra days will show here." />;
  }

  return (
    <ol className="relative px-4 py-2 md:px-5" aria-label="Plan history">
      {timeline.data.map((e, i) => {
        const { icon: Icon, tone, title } = describe(e);
        const last = i === timeline.data.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-5 last:pb-3">
            {!last && <span className="absolute left-[17px] top-10 h-[calc(100%-2.5rem)] w-px bg-line" aria-hidden />}
            <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", TONES[tone])}>
              <Icon className="size-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 pt-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="font-semibold text-ink">{title}</p>
                {SALES.includes(e.type) && e.status && e.status !== "active" && e.status !== "expired" && <PlanStatusBadge status={e.status} size="sm" />}
              </div>
              <p className="mt-0.5 text-body-sm text-ink-3">
                <time dateTime={new Date(e.at).toISOString()}>{formatDate(e.at)}</time>
                {detailLine(e) && ` · ${detailLine(e)}`}
              </p>
              {e.note && <p className="mt-1.5 rounded-tile bg-surface-2 px-3 py-2 text-body-sm text-ink-2">{e.note}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
