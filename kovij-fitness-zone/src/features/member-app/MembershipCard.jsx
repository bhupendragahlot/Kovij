import { Link } from "react-router-dom";
import { cardState } from "./cardState";
import { formatDate, formatINR, pluralize } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

const DAY_MS = 86_400_000;

/** Soft pills carry their own background, so they stay readable on the dark card in both themes. */
const BADGE = {
  good: "bg-good-soft text-good",
  warn: "bg-warn-soft text-warn",
  info: "bg-info-soft text-info",
  bad: "bg-bad-soft text-bad",
  neutral: "bg-white/10 text-hero-ink",
};

/** Ring showing how much of the plan has been used (decorative; the numbers carry the meaning). */
function Ring({ used, tone }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 80 80" className="size-20 shrink-0 -rotate-90" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" />
      <circle cx="40" cy="40" r={r} fill="none" stroke={tone === "warn" ? "var(--kv-warn)" : "var(--kv-brand)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${c * Math.min(1, Math.max(0.02, used))} ${c}`} />
    </svg>
  );
}

const ctaClass = "mt-5 inline-flex h-11 items-center justify-center rounded-full bg-brand px-5 text-[15px] font-bold text-on-brand hover:opacity-90";

/** The one question every member has: "am I good to train?" */
export function MembershipCard({ standing, className }) {
  const s = standing;
  const m = s.membership;
  const st = cardState(s);
  const now = Date.now();

  let big;
  let sub;
  let cta = null;
  switch (st.key) {
    case "active":
    case "ending":
      big = pluralize(m.daysLeft, "day") + " left";
      sub = `${m.planName}, until ${formatDate(m.endDate)}`;
      if (st.key === "ending") cta = <Link to="/member/membership" className={ctaClass}>Renew plan</Link>;
      break;
    case "paused":
      big = "On hold";
      sub = m.freeze?.resumeDate ? `${m.planName} resumes on ${formatDate(m.freeze.resumeDate)}. Your end date moved out by the frozen days.` : `${m.planName} is frozen.`;
      break;
    case "pending":
      big = formatINR(s.dues.amount) + " due";
      sub = `Pay to start ${m?.planName || "your plan"}. Pay in the app or at the desk.`;
      cta = <Link to="/member/payments" className={ctaClass}>Pay now</Link>;
      break;
    case "upcoming":
      big = `Starts ${formatDate(m.startDate)}`;
      sub = `${m.planName}, ${pluralize(m.totalDays, "day")}`;
      break;
    case "expired":
      big = `Ended ${pluralize(Math.max(1, Math.round((now - new Date(m.endDate)) / DAY_MS)), "day")} ago`;
      sub = `${m.planName} ended on ${formatDate(m.endDate)}. Come back any time.`;
      cta = <Link to="/member/membership" className={ctaClass}>Renew plan</Link>;
      break;
    default:
      big = "Ready to start?";
      sub = "Pick a plan and pay in the app or at the desk.";
      cta = <Link to="/member/membership" className={ctaClass}>See plans</Link>;
  }

  const used = m?.totalDays && m.daysLeft != null ? 1 - m.daysLeft / m.totalDays : 0;

  return (
    <section aria-label="Your membership" className={cn("rounded-hero bg-hero p-5 text-hero-ink shadow-pop sm:p-6", className)}>
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-bold", BADGE[st.tone])}>
            <st.icon className="size-3.5" aria-hidden />
            {st.badge}
          </span>
          <p className="mt-3 text-[30px] font-bold leading-tight tracking-[-0.02em]">{big}</p>
          <p className="mt-1 text-[15px] text-hero-ink-2">{sub}</p>
          {s.next && (st.key === "active" || st.key === "ending") && (
            <p className="mt-2 text-[13px] text-hero-ink-2">
              {s.next.status === "pending"
                ? `Next: ${s.next.planName}, starts right after this one once it’s paid`
                : `Next: ${s.next.planName} from ${formatDate(s.next.startDate)}`}
            </p>
          )}
          {cta}
        </div>
        {(st.key === "active" || st.key === "ending") && <Ring used={used} tone={st.tone} />}
      </div>
    </section>
  );
}
