import { Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Check, ChevronLeft, ChevronRight, PauseCircle } from "lucide-react";
import { ChartFrame, ChartTooltip, LegendItem } from "../../shared/ui/charts/ChartFrame";
import { usePrefersReducedMotion } from "../../shared/hooks/useMediaQuery";
import { Badge, Button, IconButton, Input, StatusBadge } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatHour, formatNumber, formatTime, gymDayKey, pluralize } from "../../shared/lib/format";
import {
  VISIT_STATUS,
  dayOfMonth,
  formatDayLong,
  formatDayShort,
  formatDuration,
  formatMonthLong,
  formatMonthShort,
  shiftDay,
  shiftMonth,
  weekdayOf,
} from "./lib";

const AXIS_TICK = { fontSize: 12, fontFamily: "inherit" };
const INITIAL = { width: 320, height: 200 };

/** "In gym" / "Checked out" / "No check-out", always icon + word. */
export function VisitStatusBadge({ status, size = "sm" }) {
  const meta = VISIT_STATUS[status];
  if (!meta) return null;
  return (
    <Badge tone={meta.tone} icon={meta.icon} size={size}>
      {meta.label}
    </Badge>
  );
}

/** In and out times with the visit length, e.g. "6:05 am – 7:10 am · 1 h 5 min". */
export function VisitTimes({ visit, className }) {
  return (
    <span className={cn("tabular", className)}>
      {formatTime(visit.checkedInAt)}
      {visit.checkedOutAt ? ` – ${formatTime(visit.checkedOutAt)}` : ""}
      {visit.durationMinutes != null && <span className="text-ink-3"> · {formatDuration(visit.durationMinutes)}</span>}
    </span>
  );
}

/** Why a member can't walk in: plan state as a badge ("On hold" for a paused plan). */
export function BlockedBadge({ state }) {
  if (state === "paused") {
    return (
      <Badge tone="info" icon={PauseCircle} size="sm">
        On hold
      </Badge>
    );
  }
  return <StatusBadge kind="member" status={state === "pending" ? "pending" : state === "none" ? "none" : state === "upcoming" ? "upcoming" : "expired"} size="sm" />;
}

/** Previous / date / next, with a jump back to today. Days after today can't be picked. */
export function DayPicker({ value, onChange }) {
  const today = gymDayKey();
  const isToday = value === today;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1">
        <IconButton icon={ChevronLeft} label="Previous day" variant="secondary" onClick={() => onChange(shiftDay(value, -1))} />
        <Input
          type="date"
          aria-label="Day"
          value={value}
          max={today}
          onChange={(e) => e.target.value && onChange(e.target.value > today ? today : e.target.value)}
          className="w-[10.5rem]"
        />
        <IconButton icon={ChevronRight} label="Next day" variant="secondary" disabled={isToday} onClick={() => onChange(shiftDay(value, 1))} />
      </div>
      {!isToday && (
        <Button variant="ghost" onClick={() => onChange(today)}>
          Back to today
        </Button>
      )}
    </div>
  );
}

export function MonthPicker({ value, onChange }) {
  const current = gymDayKey().slice(0, 7);
  return (
    <div className="flex items-center gap-1">
      <IconButton icon={ChevronLeft} label="Previous month" variant="secondary" onClick={() => onChange(shiftMonth(value, -1))} />
      <p className="min-w-[9.5rem] text-center text-body-lg font-semibold text-ink" aria-live="polite">
        {formatMonthLong(value)}
      </p>
      <IconButton icon={ChevronRight} label="Next month" variant="secondary" disabled={value >= current} onClick={() => onChange(shiftMonth(value, 1))} />
    </div>
  );
}

/** Check-ins per hour for one day (brand bars) against the typical same weekday (muted line). */
export function DayHourlyChart({ data, isToday, className }) {
  const reduceMotion = usePrefersReducedMotion();
  const active = data.filter((d) => d.count > 0 || d.typical > 0).map((d) => d.hour);
  const from = Math.min(5, ...(active.length ? active : [5]));
  const to = Math.max(22, ...(active.length ? active : [22]));
  const rows = data.filter((d) => d.hour >= from && d.hour <= to).map((d) => ({ ...d, label: formatHour(d.hour) }));
  const dayLabel = isToday ? "Today" : "This day";
  return (
    <ChartFrame
      className={className}
      title="Check-ins by hour"
      legend={
        <>
          <LegendItem color="var(--kv-chart-1)">{dayLabel}</LegendItem>
          <LegendItem color="var(--kv-chart-muted)" shape="line">
            Typical for this weekday
          </LegendItem>
        </>
      }
      table={{
        caption: "Check-ins by hour",
        columns: ["Hour", dayLabel, "Typical"],
        rows: rows.filter((r) => r.count || r.typical).map((r) => [r.label, r.count, r.typical]),
      }}
    >
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <ComposedChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" strokeWidth={1} />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-chart-grid)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={16} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip />} />
            <Bar dataKey="count" name={dayLabel} fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion} />
            <Line dataKey="typical" name="Typical" type="monotone" stroke="var(--kv-chart-muted)" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2 }} isAnimationActive={!reduceMotion} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

/** Visits per month for one member. Single series: the title names it, no legend. */
export function VisitsTrendChart({ data }) {
  const reduceMotion = usePrefersReducedMotion();
  const rows = data.map((d) => ({ ...d, label: formatMonthShort(d.month) }));
  return (
    <ChartFrame
      title="Visits per month"
      table={{ caption: "Visits per month", columns: ["Month", "Visits"], rows: rows.map((r) => [formatMonthLong(r.month), r.visits]) }}
    >
      <div className="h-44 lg:h-80">
        <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
          <BarChart data={rows} margin={{ top: 8, right: 4, bottom: 0, left: -12 }} barCategoryGap="30%">
            <CartesianGrid vertical={false} stroke="var(--kv-chart-grid)" />
            <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "var(--kv-line-strong)" }} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} interval="preserveStartEnd" minTickGap={8} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={36} tick={{ ...AXIS_TICK, fill: "var(--kv-ink-3)" }} />
            <Tooltip cursor={{ fill: "var(--kv-surface-2)" }} content={<ChartTooltip />} />
            <Bar dataKey="visits" name="Visits" fill="var(--kv-chart-1)" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={!reduceMotion} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartFrame>
  );
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Month grid, weeks starting Monday (the gym's closed Sunday sits at the end of each row). */
function MonthGrid({ days, renderDay, label }) {
  if (!days?.length) return null;
  const lead = (weekdayOf(days[0].date) + 6) % 7;
  return (
    <div role="group" aria-label={label}>
      <div className="mb-1 grid grid-cols-7 gap-1 sm:gap-1.5" aria-hidden>
        {WEEKDAYS.map((w) => (
          <span key={w} className="text-center text-label font-semibold text-ink-3">
            {w}
          </span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-1 sm:gap-1.5">
        {Array.from({ length: lead }, (_, i) => (
          <li key={`lead-${i}`} aria-hidden />
        ))}
        {days.map((d) => (
          <li key={d.date} className="min-w-0">
            {renderDay(d)}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Four steps of brand intensity, relative to the busiest day of the month. */
const HEAT = ["bg-surface-2 text-ink", "bg-brand/15 text-ink", "bg-brand/35 text-ink", "bg-brand/60 text-ink", "bg-brand text-on-brand"];

function heatLevel(visits, max) {
  if (!visits || !max) return 0;
  return Math.min(4, Math.max(1, Math.ceil((visits / max) * 4)));
}

/**
 * Gym-wide month: each day shows its visit count (so colour is never the only signal).
 * Tapping a day opens that day's list.
 */
export function MonthHeatmap({ days, onSelectDay }) {
  const today = gymDayKey();
  const max = Math.max(0, ...days.map((d) => d.visits));
  return (
    <div className="max-w-2xl">
      <MonthGrid
        days={days}
        label="Visits per day"
        renderDay={(d) => {
          const level = heatLevel(d.visits, max);
          const closed = !d.open && !d.visits;
          const description = d.future
            ? `${formatDayLong(d.date)}: not yet`
            : `${formatDayLong(d.date)}: ${pluralize(d.visits, "visit")}${d.holiday ? `, holiday (${d.holiday})` : closed ? ", gym closed" : ""}`;
          return (
            <button
              type="button"
              disabled={d.future}
              onClick={() => onSelectDay(d.date)}
              aria-label={description}
              title={description}
              className={cn(
                "flex aspect-square w-full min-h-11 flex-col items-start justify-between rounded-[10px] p-1 text-left transition-colors sm:p-1.5",
                d.future ? "bg-surface text-ink-3 opacity-60" : closed ? "bg-surface text-ink-3 border border-dashed border-line-strong" : HEAT[level],
                !d.future && "hover:ring-2 hover:ring-line-strong",
                d.date === today && "ring-2 ring-ink"
              )}
            >
              <span className="text-label-sm font-semibold leading-none opacity-80">{dayOfMonth(d.date)}</span>
              {!d.future && (
                <span className="tabular w-full text-right text-body-sm font-bold leading-none sm:text-body-lg">{closed ? "–" : formatNumber(d.visits)}</span>
              )}
            </button>
          );
        }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-body-sm text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          Fewer
          {HEAT.map((cls, i) => (
            <span key={i} aria-hidden className={cn("size-3.5 rounded-[4px]", cls.split(" ")[0])} />
          ))}
          More visits
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3.5 rounded-[4px] border border-dashed border-line-strong" />
          Gym closed
        </span>
      </div>
    </div>
  );
}

/** One member's month: visited days are filled and ticked; closed days are outlined. */
export function MemberMonthCalendar({ days }) {
  const today = gymDayKey();
  return (
    <div>
      <MonthGrid
        days={days}
        label="Days visited this month"
        renderDay={(d) => {
          const v = d.visit;
          const closed = !d.open && !v;
          const description = v
            ? `${formatDayShort(d.date)}: visited, in ${formatTime(v.checkedInAt)}${v.checkedOutAt ? `, out ${formatTime(v.checkedOutAt)}` : ""}`
            : `${formatDayShort(d.date)}: ${d.future ? "not yet" : closed ? `gym closed${d.holiday ? ` (${d.holiday})` : ""}` : "no visit"}`;
          return (
            <div
              role="img"
              aria-label={description}
              title={description}
              className={cn(
                "flex aspect-square min-h-10 w-full flex-col items-center justify-center gap-0.5 rounded-[10px] text-body-sm font-semibold",
                v ? "bg-brand text-on-brand" : closed ? "border border-dashed border-line-strong text-ink-3" : d.future ? "text-ink-3 opacity-50" : "bg-surface-2 text-ink-2",
                d.date === today && "ring-2 ring-ink"
              )}
            >
              <span className="tabular leading-none">{dayOfMonth(d.date)}</span>
              {v && <Check className="size-3.5" aria-hidden strokeWidth={3} />}
            </div>
          );
        }}
      />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-body-sm text-ink-3">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="grid size-3.5 place-items-center rounded-[4px] bg-brand text-on-brand">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
          Visited
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="size-3.5 rounded-[4px] border border-dashed border-line-strong" />
          Gym closed
        </span>
      </div>
    </div>
  );
}
