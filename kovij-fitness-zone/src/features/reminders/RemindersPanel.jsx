import { useState } from "react";
import { Link } from "react-router-dom";
import { BellOff, BellRing, CalendarCheck, CheckCheck, CircleCheck, Send, Settings2, TriangleAlert } from "lucide-react";
import { useReminderOverview, useReminderPreview, useReminderStats, useRunReminders } from "./api";
import { hourLabel } from "./reminderSettings";
import NotificationLog from "../notifications/NotificationLog";
import { KindBadge } from "../notifications/components";
import { NOTIFICATION_KIND, REMINDER_KINDS, SKIP_REASON } from "../notifications/labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import {
  Badge,
  Button,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  ErrorState,
  Field,
  InlineAlert,
  Input,
  KpiTile,
  Skeleton,
  SkeletonList,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatDate, formatINR, formatNumber, formatRelativeDay, formatRelativeTime, formatTime, gymDayKey, pluralize } from "../../shared/lib/format";

const PREVIEW_DAYS = 30;

const joinWords = (list) => (list.length <= 1 ? list.join("") : `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`);

function scheduleSummary(s) {
  const parts = [];
  if (s.expiryDaysBefore.length) parts.push(`${joinWords([...s.expiryDaysBefore].sort((a, b) => b - a).map(String))} days before a plan ends`);
  if (s.onExpiryDay) parts.push("on the last day");
  if (s.afterExpiryDays.length) parts.push(`“we miss you” ${joinWords(s.afterExpiryDays.map(String))} days after`);
  if (s.paymentDue) parts.push(s.paymentDueEveryDays === 1 ? "dues every day" : `dues every ${s.paymentDueEveryDays} days`);
  if (s.birthday) parts.push("birthdays");
  return parts.length ? `${parts.join(", ")}. Sent at ${hourLabel(s.sendHour)}.` : "Every reminder type is turned off.";
}

function Readiness({ ready, label, missing }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      {ready ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-good" aria-hidden /> : <TriangleAlert className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />}
      <span>
        <span className="font-semibold text-ink">{label}: </span>
        <span className="text-ink-2">{ready ? "ready" : missing}</span>
      </span>
    </div>
  );
}

function StatusCard({ overview }) {
  if (overview.isPending) {
    return (
      <Card padding="lg" className="flex flex-col gap-3">
        <Skeleton className="h-5 w-64" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-4 w-56" />
      </Card>
    );
  }
  if (overview.isError) {
    return (
      <Card>
        <ErrorState compact error={overview.error} onRetry={() => overview.refetch()} />
      </Card>
    );
  }
  const o = overview.data;
  const on = o.settings.enabled;
  const last = o.lastRun;
  const next = o.nextRunAt ? `${formatRelativeDay(o.nextRunAt)} at ${formatTime(o.nextRunAt)}` : null;
  return (
    <Card padding="lg">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className={`grid size-11 shrink-0 place-items-center rounded-tile ${on ? "bg-good-soft text-good" : "bg-surface-2 text-ink-2"}`}>
            {on ? <BellRing className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-bold text-ink">{on ? "Automatic reminders are on" : "Automatic reminders are off"}</h2>
            <p className="mt-0.5 text-sm text-ink-2">
              {on ? (o.doneToday ? `Today's reminders have gone out. Next: ${next}.` : `Next: ${next}.`) : "Members aren't reminded about renewals or dues until you turn them on."}
            </p>
            {on && <p className="mt-1 text-[13px] text-ink-3">{scheduleSummary(o.settings)}</p>}
            {last && (
              <p className="mt-1 text-[13px] text-ink-3">
                Last run {formatRelativeTime(last.finishedAt || last.startedAt)} ({last.trigger === "manual" ? `sent by ${last.triggeredBy?.name || "staff"}` : "automatic"}):{" "}
                {last.status === "failed"
                  ? "stopped with an error, it will try again."
                  : `${formatNumber(last.totals?.sent)} sent, ${formatNumber(last.totals?.alreadySent)} already sent${last.totals?.failed ? `, ${formatNumber(last.totals.failed)} failed` : ""}.`}
              </p>
            )}
          </div>
        </div>
        <ButtonLink to="/admin/settings?tab=reminders" variant="secondary" icon={Settings2} className="self-start">
          {on ? "Change reminders" : "Turn on reminders"}
        </ButtonLink>
      </div>
      <div className="mt-4 grid grid-cols-1 gap-2 border-t border-line pt-4 sm:grid-cols-2">
        <Readiness ready={o.channels.email} label="Email" missing="not set up on the server yet, so members only see reminders in the app" />
        <Readiness ready={o.channels.push} label="Phone notifications" missing="not set up on the server yet" />
      </div>
      {!o.scheduler && (
        <InlineAlert tone="warning" className="mt-4">
          This server isn't running scheduled jobs, so reminders only go out when you press Send now.
        </InlineAlert>
      )}
    </Card>
  );
}

function detailLine(item) {
  const d = item.detail || {};
  if (item.kind === "expiry_reminder" || item.kind === "expiry_today") return `${d.planName || "Plan"}, ends ${formatDate(d.endDate)}`;
  if (item.kind === "come_back") return `${d.planName || "Plan"}, ended ${formatDate(d.endDate)}`;
  if (item.kind === "payment_due") return `${formatINR(d.amount)} due, reminder ${d.reminderNo} of 6`;
  return "";
}

function channelsLine(item) {
  const list = ["in the app"];
  if (item.channels.email) list.push("email");
  if (item.channels.push) list.push("phone");
  return `By ${joinWords(list)}`;
}

function PreviewRow({ item }) {
  const sent = item.status === "already_sent";
  const detail = detailLine(item);
  return (
    <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:gap-4">
      <div className="min-w-0 flex-1">
        <Link to={`/admin/members/${item.member._id}`} className="font-semibold text-ink hover:underline">
          {item.member.name}
        </Link>
        {item.member.memberCode && <span className="ml-1.5 text-[13px] text-ink-3">{item.member.memberCode}</span>}
        <p className="text-sm text-ink-2">{item.title}</p>
        <p className="text-[13px] text-ink-3">
          {detail ? `${detail}. ` : ""}
          {channelsLine(item)}.
        </p>
      </div>
      <Badge size="sm" tone={sent ? "good" : "info"} icon={sent ? CheckCheck : Send} className="self-start sm:self-center">
        {sent ? "Already sent" : "Will send"}
      </Badge>
    </li>
  );
}

function PreviewCard() {
  const today = gymDayKey();
  const [date, setDate] = useState(today);
  const isToday = date === today;
  const preview = useReminderPreview(isToday ? undefined : date);
  const run = useRunReminders();
  const idempotency = useIdempotencyKey();
  const confirm = useConfirm();
  const toast = useToast();
  const online = useOnlineStatus();
  const maxDay = gymDayKey(new Date(Date.now() + PREVIEW_DAYS * 86_400_000));

  const data = preview.data;
  const willSend = data?.counts.willSend ?? 0;
  const skippedReasons = Object.entries(data?.skippedByReason || {});

  const onSend = async () => {
    const ok = await confirm({
      title: "Send today's reminders now?",
      body: `${pluralize(willSend, "member")} will get a reminder. Anyone already reminded today won't get it again.`,
      confirmLabel: "Send now",
    });
    if (!ok) return;
    run.mutate(
      { idempotencyKey: idempotency.keyFor({ action: "run", day: today }) },
      {
        onSuccess: (res) => {
          idempotency.reset();
          const t = res.run.totals;
          toast.success("Reminders sent", {
            description: `${formatNumber(t.sent)} sent${t.alreadySent ? `, ${formatNumber(t.alreadySent)} already sent earlier` : ""}${t.failed ? `, ${formatNumber(t.failed)} failed` : ""}.`,
          });
        },
        onError: (e) => toast.error("Couldn't send reminders", { description: e.message }),
      }
    );
  };

  const groups = REMINDER_KINDS.map((kind) => ({ kind, items: (data?.items || []).filter((i) => i.kind === kind) })).filter((g) => g.items.length);

  return (
    <Card padding="lg">
      <CardHeader
        title={isToday ? "Today's reminders" : `Reminders on ${formatDate(`${date}T12:00:00+05:30`)}`}
        description={isToday ? "Who gets what today. Anyone already reminded won't get it again." : "Based on today's plans and dues. Renewals and payments before then will change it."}
      />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <Field label="Day" className="sm:w-52">
          <Input type="date" value={date} min={today} max={maxDay} onChange={(e) => setDate(e.target.value || today)} />
        </Field>
        {isToday && (
          <div className="flex flex-col items-stretch gap-1 sm:items-end">
            <Button
              variant="primary"
              icon={Send}
              onClick={onSend}
              loading={run.isPending}
              disabled={!online || !data?.enabled || willSend === 0 || preview.isPending}
            >
              Send now
            </Button>
            {!online && <p className="text-[13px] font-medium text-warn">You're offline. Sending works when the connection is back.</p>}
          </div>
        )}
      </div>

      {data && !data.enabled && (
        <InlineAlert tone="warning" className="mb-4">
          Reminders are turned off, so nothing will be sent. This is what would go out.
        </InlineAlert>
      )}

      {preview.isPending ? (
        <SkeletonList rows={4} />
      ) : preview.isError ? (
        <ErrorState compact error={preview.error} onRetry={() => preview.refetch()} />
      ) : !data.items.length ? (
        <EmptyState
          compact
          icon={CalendarCheck}
          title={isToday ? "No reminders today" : "No reminders that day"}
          body="Nobody's plan ends on a reminder day, no dues need a reminder, and there are no birthdays."
        />
      ) : (
        <>
          <p className="mb-2 text-sm text-ink-2" aria-live="polite">
            {pluralize(willSend, "reminder")} to send
            {data.counts.alreadySent ? `, ${formatNumber(data.counts.alreadySent)} already sent` : ""}.
          </p>
          <div className="flex flex-col gap-4">
            {groups.map((g) => (
              <section key={g.kind} aria-label={NOTIFICATION_KIND[g.kind].label}>
                <div className="flex items-center gap-2 border-b border-line pb-2">
                  <KindBadge kind={g.kind} size="md" />
                  <span className="tabular text-[13px] text-ink-3">{formatNumber(g.items.length)}</span>
                </div>
                <ul className="divide-y divide-line">
                  {g.items.map((item) => (
                    <PreviewRow key={`${item.kind}-${item.member._id}`} item={item} />
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}

      {data && skippedReasons.length > 0 && (
        <details className="mt-4 rounded-tile bg-surface-2 p-3.5 text-sm">
          <summary className="cursor-pointer font-semibold text-ink">
            Not sent to {pluralize(data.skipped.length, "member")}:{" "}
            <span className="font-normal text-ink-2">{skippedReasons.map(([reason, n]) => `${formatNumber(n)} ${SKIP_REASON[reason] || reason}`).join(", ")}</span>
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-ink-2">
            {data.skipped.map((s) => (
              <li key={`${s.kind}-${s.member._id}-${s.reason}`}>
                {s.member.name || "Member"}: {NOTIFICATION_KIND[s.kind]?.label.toLowerCase()}, {SKIP_REASON[s.reason] || s.reason}
              </li>
            ))}
          </ul>
        </details>
      )}
    </Card>
  );
}

function Stats() {
  const stats = useReminderStats(30);
  if (stats.isError) {
    return (
      <Card>
        <ErrorState compact error={stats.error} onRetry={() => stats.refetch()} title="Reminder numbers didn't load" />
      </Card>
    );
  }
  const byKind = Object.fromEntries((stats.data?.kinds || []).map((k) => [k.kind, k]));
  return (
    <section aria-label="Reminders in the last 30 days">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">Last 30 days</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {REMINDER_KINDS.map((kind) => {
          const k = byKind[kind];
          return (
            <KpiTile
              key={kind}
              label={NOTIFICATION_KIND[kind].label}
              icon={NOTIFICATION_KIND[kind].icon}
              loading={stats.isPending}
              value={formatNumber(k?.total)}
              sub={k ? `${formatNumber(k.read)} read${k.emailFailed ? `, ${formatNumber(k.emailFailed)} emails failed` : ""}` : undefined}
            />
          );
        })}
      </div>
    </section>
  );
}

/** Automatic reminders: status, who gets what today (with Send now), numbers, and history. */
export default function RemindersPanel() {
  const overview = useReminderOverview();
  return (
    <div className="flex flex-col gap-5">
      <StatusCard overview={overview} />
      <PreviewCard />
      <Stats />
      <NotificationLog source="reminders" title="Reminder history" description="Every automatic reminder and how it reached the member." />
    </div>
  );
}
