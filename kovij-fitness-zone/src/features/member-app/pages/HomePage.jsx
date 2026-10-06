import { Link } from "react-router-dom";
import { ChevronRight, Clock, Dumbbell, Flame, ListChecks, Footprints, LifeBuoy, Megaphone, MessageCircle, Phone, RefreshCcw, Scale, Wallet } from "lucide-react";
import { useMemberAuth } from "../../../context/MemberAuthContext";
import { MembershipCard } from "../MembershipCard";
import { useAnnouncements, useExerciseSchedule, useGym, useHome, useMyMembership, useMyTrainer, useWorkout } from "../queries";
import { openState } from "../../settings/hours";
import { Avatar, Card, CardHeader, ErrorState, Skeleton } from "../../../shared/ui";
import { formatINR, formatNumber, formatRelativeDay, formatRelativeTime, greeting, phoneHref, pluralize } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

/** Member home: am I good to train, what's next, and how am I doing. */
export default function HomePage() {
  const { member } = useMemberAuth();
  const standing = useMyMembership();
  const home = useHome();
  const first = (member?.name || "").split(" ")[0];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-title font-bold">
        {greeting()}
        {first ? `, ${first}` : ""}
      </h1>

      {standing.isPending ? (
        <Skeleton className="h-48 rounded-hero" />
      ) : standing.isError ? (
        <Card>
          <ErrorState compact error={standing.error} onRetry={() => standing.refetch()} />
        </Card>
      ) : (
        <MembershipCard standing={standing.data} />
      )}

      <QuickActions standing={standing.data} />
      {home.isPending ? <Skeleton className="h-44 rounded-card" /> : home.data && <Stats home={home.data} dues={standing.data?.dues} />}
      {home.data && <ThisWeek week={home.data.visits.week} />}
      <GymNow crowd={home.data?.crowd} />
      <TodayExercises />
      <TodayWorkout />
      <TrainerCard />
      <LatestUpdate />
    </div>
  );
}

function Chip({ to, href, icon: Icon, children, external }) {
  const cls = "inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2";
  if (href) {
    return (
      <a href={href} className={cls} {...(external && { target: "_blank", rel: "noreferrer" })}>
        <Icon className="size-4" aria-hidden />
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={cls}>
      <Icon className="size-4" aria-hidden />
      {children}
    </Link>
  );
}

function QuickActions({ standing }) {
  const gym = useGym().data;
  const renew = standing && (standing.endingSoon || ["expired", "none"].includes(standing.state));
  const dues = standing?.dues?.count > 0;
  const tel = phoneHref(gym?.phone);
  const wa = phoneHref(gym?.whatsapp || gym?.phone, "whatsapp");
  return (
    <nav aria-label="Quick actions" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <div className="flex w-max gap-2">
        {dues && (
          <Chip to="/member/payments" icon={Wallet}>
            Pay {formatINR(standing.dues.amount)}
          </Chip>
        )}
        {renew && (
          <Chip to="/member/membership" icon={RefreshCcw}>
            Renew plan
          </Chip>
        )}
        {tel && (
          <Chip href={tel} icon={Phone}>
            Call the desk
          </Chip>
        )}
        {wa && (
          <Chip href={wa} icon={MessageCircle} external>
            WhatsApp
          </Chip>
        )}
        <Chip to="/member/support/new" icon={LifeBuoy}>
          Ask the gym
        </Chip>
      </div>
    </nav>
  );
}

function Tile({ icon: Icon, label, value, sub, to }) {
  const body = (
    <>
      <span className="flex items-center justify-between text-[13px] font-semibold text-ink-3">
        {label}
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="tabular mt-2 block text-[24px] font-bold leading-tight">{value}</span>
      {sub && <span className="mt-1 block text-[13px] text-ink-3">{sub}</span>}
    </>
  );
  const cls = "rounded-card bg-surface p-4 shadow-[0_1px_0_var(--kv-line)]";
  return to ? (
    <Link to={to} className={cn(cls, "hover:bg-surface-2")}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function Stats({ home, dues }) {
  const v = home.visits;
  return (
    <section aria-label="Your numbers" className="grid grid-cols-2 gap-3">
      <Tile
        icon={Footprints}
        label="Visits this month"
        to="/member/visits"
        value={formatNumber(v.thisMonth)}
        sub={v.lastVisitAt ? `Last: ${formatRelativeDay(v.lastVisitAt)}` : "No visits yet"}
      />
      <Tile
        icon={Flame}
        label="Streak"
        to="/member/visits"
        value={pluralize(v.streak?.current || 0, "day")}
        sub={v.streak?.longest ? `Best: ${pluralize(v.streak.longest, "day")}` : "Visit today to start one"}
      />
      <Tile
        icon={Scale}
        label="Weight"
        to="/member/progress"
        value={home.weight ? `${home.weight.latestKg} kg` : "Not yet"}
        sub={home.weight?.changeKg != null ? `${home.weight.changeKg > 0 ? "+" : ""}${home.weight.changeKg} kg since you started` : "Add your first entry"}
      />
      <Tile icon={Wallet} label="Dues" to="/member/payments" value={dues?.amount ? formatINR(dues.amount) : "All paid"} sub={dues?.count ? pluralize(dues.count, "bill") : "Nothing to pay"} />
    </section>
  );
}

function ThisWeek({ week }) {
  return (
    <Card>
      <CardHeader title="This week" description={`${pluralize(week.filter((d) => d.visited).length, "visit")} so far`} />
      <ol className="grid grid-cols-7 gap-1 text-center">
        {week.map((d) => (
          <li key={d.day} className="flex flex-col items-center gap-1.5">
            <span className="text-[12px] font-semibold text-ink-3">{d.label.slice(0, 1)}</span>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-full text-[13px] font-bold",
                d.visited ? "bg-brand text-on-brand" : d.isToday ? "border-2 border-dashed border-brand text-ink" : d.isFuture ? "bg-surface-2 text-ink-3" : "bg-surface-2 text-ink-2"
              )}
              aria-label={`${d.label}${d.isToday ? ", today" : ""}: ${d.visited ? "visited" : d.isFuture ? "coming up" : "no visit"}`}
            >
              {Number(d.day.slice(8))}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}

const CROWD = { quiet: "Quiet right now", moderate: "Getting busy", busy: "Busy right now" };
const hourText = (h) => `${h % 12 || 12} ${h < 12 ? "am" : "pm"}`;

function GymNow({ crowd }) {
  const gym = useGym().data;
  if (!gym) return null;
  const state = openState(gym.openingHours, gym.holidays);
  const max = Math.max(1, ...(crowd?.hours || []).map((h) => h.typical));
  return (
    <Card>
      <CardHeader title="At the gym" description={state.label} />
      {state.open && crowd?.hours?.length > 0 && (
        <>
          <p className="mb-3 text-sm font-semibold">
            {CROWD[crowd.level]}
            {crowd.quieterAt != null && <span className="font-normal text-ink-3"> · usually quieter from {hourText(crowd.quieterAt)}</span>}
          </p>
          <div className="flex h-16 items-end gap-[3px]" aria-hidden>
            {crowd.hours.map((h) => (
              <span
                key={h.hour}
                className={cn("flex-1 rounded-t-[3px]", h.hour === crowd.hourNow ? "bg-brand" : "bg-surface-3")}
                style={{ height: `${Math.max(6, (h.typical / max) * 100)}%` }}
                title={`${hourText(h.hour)}: usually ${h.typical} people`}
              />
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[11px] text-ink-3" aria-hidden>
            <span>{hourText(crowd.hours[0].hour)}</span>
            <span>{hourText(crowd.hours.at(-1).hour)}</span>
          </div>
          <p className="sr-only">Typical crowd today: {crowd.hours.map((h) => `${hourText(h.hour)} ${h.typical}`).join(", ")}</p>
        </>
      )}
      {!state.open && (
        <p className="flex items-center gap-2 text-sm text-ink-3">
          <Clock className="size-4" aria-hidden />
          Hours are in your profile under Gym details.
        </p>
      )}
    </Card>
  );
}

/** Exercises the trainer scheduled for today (and any still open from earlier this week). */
function TodayExercises() {
  const s = useExerciseSchedule().data;
  if (!s || (!s.today.length && !s.overdue.length)) return null;
  const left = s.today.filter((a) => a.status !== "completed").length + s.overdue.filter((a) => a.status !== "completed").length;
  const done = s.today.filter((a) => a.status === "completed").length;
  return (
    <Link to="/member/workouts?tab=schedule" className="group">
      <Card className="flex items-center gap-4 group-hover:bg-surface-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink">
          <ListChecks className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink-3">From your trainer</span>
          <span className="block truncate text-[17px] font-bold">{left ? `${pluralize(left, "exercise")} to do` : "All done for today"}</span>
          <span className="block truncate text-[13px] text-ink-3">
            {s.today.length ? `${done} of ${s.today.length} done today` : "Left over from earlier this week"}
          </span>
        </span>
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Card>
    </Link>
  );
}

function TodayWorkout() {
  const w = useWorkout();
  const today = w.data?.today;
  if (!w.data?.plan || !today?.day) return null;
  return (
    <Link to="/member/workouts" className="group">
      <Card className="flex items-center gap-4 group-hover:bg-surface-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-brand-soft text-brand-ink">
          <Dumbbell className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink-3">{today.doneToday ? "Done today" : "Today’s workout"}</span>
          <span className="block truncate text-[17px] font-bold">{today.day.name}</span>
          <span className="block text-[13px] text-ink-3">
            {pluralize(today.day.exercises.length, "exercise")} · {w.data.plan.name}
          </span>
        </span>
        <ChevronRight className="size-5 text-ink-3" aria-hidden />
      </Card>
    </Link>
  );
}

function TrainerCard() {
  const t = useMyTrainer().data?.trainer;
  if (!t) return null;
  return (
    <Card className="flex items-center gap-4">
      <Avatar name={t.name} src={t.image} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-ink-3">Your trainer</p>
        <p className="truncate text-[17px] font-bold">{t.name}</p>
        <p className="truncate text-[13px] text-ink-3">{[t.title, t.scheduleText].filter(Boolean).join(" · ")}</p>
      </div>
      {t.contact?.whatsappUrl && (
        <a href={t.contact.whatsappUrl} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${t.name}`} className="grid size-11 shrink-0 place-items-center rounded-full border border-line-strong text-ink-2 hover:bg-surface-2">
          <MessageCircle className="size-5" aria-hidden />
        </a>
      )}
    </Card>
  );
}

function LatestUpdate() {
  const a = useAnnouncements().data?.items?.[0];
  if (!a) return null;
  return (
    <Link to="/member/notifications?tab=gym" className="group">
      <Card className="flex gap-4 group-hover:bg-surface-2">
        <span className="grid size-12 shrink-0 place-items-center rounded-tile bg-info-soft text-info">
          <Megaphone className="size-6" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-semibold text-ink-3">From the gym · {formatRelativeTime(a.publishAt)}</span>
          <span className="block font-bold">{a.title}</span>
          <span className="line-clamp-2 block text-sm text-ink-2">{a.body}</span>
        </span>
      </Card>
    </Link>
  );
}
