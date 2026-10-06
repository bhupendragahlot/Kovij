import { lazy, Suspense, useState } from "react";
import { CircleAlert, Ellipsis, Megaphone, Pencil, Pin, PinOff, Plus, Send, Trash2, Undo2, Users } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchAudienceSize, useAnnouncements, useDeleteAnnouncement, usePublishAnnouncement, useSaveAnnouncement, useUnpublishAnnouncement } from "./api";
import { AnnouncementDialog } from "./AnnouncementDialog";
import { ANNOUNCEMENT_STATE, CATEGORY } from "./labels";
import { AUDIENCE_LABEL } from "../notifications/labels";
import { usePermission } from "../auth/permissions";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  IconButton,
  Menu,
  Meter,
  PageHeader,
  Pagination,
  SkeletonList,
  Tabs,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatDateTime, formatNumber, formatRelativeTime, formatShortDate, pluralize } from "../../shared/lib/format";

const RemindersPanel = lazy(() => import("../reminders/RemindersPanel"));
const NotificationLog = lazy(() => import("../notifications/NotificationLog"));

const DEFAULTS = { tab: "announcements", status: "all", page: 1 };
const LIMIT = 20;

const STATUS_FILTERS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "ended", label: "Ended" },
  { value: "unpublished", label: "Taken down" },
];

function whenLine(a) {
  if (a.state === "live") return `Live since ${formatShortDate(a.publishAt)}${a.expiresAt ? `, until ${formatShortDate(a.expiresAt)}` : ""}`;
  if (a.state === "scheduled") return `Goes out ${formatDateTime(a.publishAt)}`;
  if (a.state === "ended") return `Ended ${formatShortDate(a.expiresAt)}`;
  if (a.state === "unpublished") return `Taken down ${formatRelativeTime(a.unpublishedAt || a.updatedAt)}`;
  return `Draft, edited ${formatRelativeTime(a.updatedAt)}`;
}

/** Failures link to the sent log (with reasons) for roles that can open it. */
function FailedNote({ onShowLog, children }) {
  const content = (
    <>
      <CircleAlert className="size-3.5" aria-hidden />
      {children}
      {onShowLog && ", see why"}
    </>
  );
  return onShowLog ? (
    <button type="button" onClick={onShowLog} className="inline-flex min-h-6 items-center gap-1 font-semibold text-bad hover:underline">
      {content}
    </button>
  ) : (
    <span className="inline-flex items-center gap-1 font-semibold text-bad">{content}</span>
  );
}

function DeliveryLine({ a, onShowLog }) {
  const d = a.delivery || {};
  if (d.state === "pending" || d.state === "running") {
    return (
      <div className="flex flex-col gap-1.5" aria-live="polite">
        <p className="text-body-sm font-semibold text-ink-2">
          Sending… {formatNumber(d.processed)} of {formatNumber(d.audienceCount)} members
        </p>
        <Meter value={d.processed || 0} max={Math.max(1, d.audienceCount || 0)} label="Delivery progress" />
      </div>
    );
  }
  if (!d.state || d.state === "none") return null;
  const s = a.stats;
  return (
    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-body-sm text-ink-3">
      <span>
        Sent to <span className="font-semibold text-ink-2">{pluralize(s.notified, "member")}</span>, {formatNumber(s.read)} read
      </span>
      {s.emailSent > 0 && <span>{pluralize(s.emailSent, "email")} sent</span>}
      {s.pushSent > 0 && <span>{pluralize(s.pushSent, "phone notification")} sent</span>}
      {(s.emailFailed > 0 || s.pushFailed > 0) && (
        <FailedNote onShowLog={onShowLog}>
          {[s.emailFailed && pluralize(s.emailFailed, "email"), s.pushFailed && pluralize(s.pushFailed, "phone notification")].filter(Boolean).join(" and ")} failed
        </FailedNote>
      )}
      {d.state === "stopped" && <span className="font-semibold text-warn">Stopped when it was taken down</span>}
    </p>
  );
}

function AnnouncementCard({ a, onEdit, onShowLog }) {
  const queryClient = useQueryClient();
  const publish = usePublishAnnouncement();
  const unpublish = useUnpublishAnnouncement();
  const save = useSaveAnnouncement();
  const remove = useDeleteAnnouncement();
  const idempotency = useIdempotencyKey();
  const confirm = useConfirm();
  const toast = useToast();
  const online = useOnlineStatus();
  const state = ANNOUNCEMENT_STATE[a.state] || ANNOUNCEMENT_STATE.draft;
  const category = CATEGORY[a.category] || CATEGORY.notice;
  const future = a.publishAt && new Date(a.publishAt) > new Date();
  const sentBefore = a.delivery?.state && a.delivery.state !== "none";
  const fail = (verb) => (e) => toast.error(`Couldn't ${verb} the announcement`, { description: e.message });

  const onPublish = async () => {
    const size = sentBefore ? null : await fetchAudienceSize(queryClient, a.audience).catch(() => null);
    const ok = await confirm({
      title: sentBefore ? "Publish it again?" : `${future ? "Schedule" : "Publish"} to ${size ? pluralize(size.reachable, "member") : AUDIENCE_LABEL[a.audience].toLowerCase()}?`,
      body: sentBefore
        ? "It shows in the app again. Members who already got it won't be notified twice."
        : `They'll get it in the app${a.sendEmail ? ", by email" : ""} and as a phone notification if they turned those on. A sent announcement can be taken down but not unsent.`,
      confirmLabel: future ? "Schedule" : "Publish",
    });
    if (!ok) return;
    publish.mutate(
      { id: a._id, idempotencyKey: idempotency.keyFor({ id: a._id, action: "publish" }) },
      {
        onSuccess: (res) => {
          idempotency.reset();
          toast.success(res.announcement.status === "scheduled" ? "Announcement scheduled" : "Announcement published");
        },
        onError: fail("publish"),
      }
    );
  };

  const onUnpublish = async () => {
    const scheduled = a.state === "scheduled";
    const ok = await confirm({
      title: scheduled ? "Cancel the schedule?" : "Take this announcement down?",
      body: scheduled ? "It goes back to drafts and nothing is sent." : "Members stop seeing it in the app. Notifications already sent stay in their inbox.",
      confirmLabel: scheduled ? "Cancel schedule" : "Take down",
      cancelLabel: scheduled ? "Keep schedule" : "Keep it live",
      tone: "danger",
    });
    if (!ok) return;
    unpublish.mutate(a._id, { onSuccess: () => toast.success(scheduled ? "Schedule cancelled" : "Announcement taken down"), onError: fail("update") });
  };

  const onDelete = async () => {
    const ok = await confirm({ title: "Delete this draft?", body: "It hasn't been sent to anyone. This can't be undone.", confirmLabel: "Delete draft", tone: "danger" });
    if (ok) remove.mutate(a._id, { onSuccess: () => toast.success("Draft deleted"), onError: fail("delete") });
  };

  const togglePin = () =>
    save.mutate({ id: a._id, payload: { pinned: !a.pinned } }, { onSuccess: () => toast.success(a.pinned ? "Announcement unpinned" : "Announcement pinned"), onError: fail("update") });

  const publishNow = () => save.mutate({ id: a._id, payload: { publishAt: null } }, { onSuccess: () => toast.success("Announcement published"), onError: fail("publish") });

  const busy = publish.isPending || unpublish.isPending || save.isPending || remove.isPending;
  let primary = null;
  if (a.state === "draft" || a.state === "unpublished") {
    primary = (
      <Button size="sm" variant="primary" icon={Send} onClick={onPublish} loading={publish.isPending} disabled={!online || busy}>
        {a.state === "unpublished" ? "Publish again" : future ? "Schedule" : "Publish"}
      </Button>
    );
  } else if (a.state === "live" || a.state === "scheduled") {
    primary = (
      <Button size="sm" variant="secondary" icon={Undo2} onClick={onUnpublish} loading={unpublish.isPending} disabled={!online || busy}>
        {a.state === "scheduled" ? "Cancel schedule" : "Take down"}
      </Button>
    );
  }

  return (
    <Card className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge size="sm" tone={state.tone} icon={state.icon}>
          {state.label}
        </Badge>
        <Badge size="sm" icon={category.icon}>
          {category.label}
        </Badge>
        {a.pinned && (
          <Badge size="sm" tone="brand" icon={Pin}>
            Pinned
          </Badge>
        )}
      </div>
      <div className="flex gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-body-lg font-semibold text-ink">{a.title}</h3>
          <p className="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-2">{a.body}</p>
        </div>
        {a.imageUrl && <img src={a.imageUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded-tile object-cover sm:size-20" />}
      </div>
      <p className="flex flex-wrap items-center gap-x-2 text-body-sm text-ink-3">
        <Users className="size-3.5" aria-hidden />
        <span>{AUDIENCE_LABEL[a.audience]}</span>
        <span aria-hidden>·</span>
        <span>{whenLine(a)}</span>
      </p>
      <DeliveryLine a={a} onShowLog={onShowLog} />
      <div className="mt-auto flex items-center gap-2 pt-1">
        {primary}
        <div className="flex-1" />
        <Menu
          label={`Actions for ${a.title}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${a.title}`} size="sm" />}
          items={[
            { label: "Edit", icon: Pencil, onSelect: () => onEdit(a) },
            a.state === "scheduled" && { label: "Publish now", icon: Send, onSelect: publishNow, disabled: !online },
            ["live", "draft", "scheduled"].includes(a.state) && { label: a.pinned ? "Unpin" : "Pin to the top", icon: a.pinned ? PinOff : Pin, onSelect: togglePin, disabled: !online },
            a.state === "ended" && { label: "Take down", icon: Undo2, onSelect: onUnpublish, disabled: !online },
            a.state === "draft" && !sentBefore && { type: "separator" },
            a.state === "draft" && !sentBefore && { label: "Delete draft", icon: Trash2, tone: "danger", onSelect: onDelete, disabled: !online },
          ]}
        />
      </div>
    </Card>
  );
}

function AnnouncementsList({ status, page, setUrl, onCreate, onEdit, onShowLog }) {
  const query = useAnnouncements({ status, page, limit: LIMIT });
  const counts = query.data?.counts || {};
  const items = query.data?.items || [];
  return (
    <>
      <FilterChips
        label="Announcement status"
        value={status}
        onChange={(s) => setUrl({ status: s })}
        options={STATUS_FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
        className="mb-4"
      />
      {query.isPending ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : query.isError && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : items.length === 0 ? (
        <Card>
          {status === "all" ? (
            <EmptyState
              icon={Megaphone}
              title="No announcements yet"
              body="Tell members about holidays, events and offers. They see it in the app, and you can email it too."
              action={
                <Button variant="primary" icon={Plus} onClick={onCreate}>
                  New announcement
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Megaphone}
              title="Nothing here"
              body="No announcements have this status."
              action={
                <Button variant="secondary" onClick={() => setUrl({ status: "all" })}>
                  Show all
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <>
          <ul className={`grid grid-cols-1 gap-4 lg:grid-cols-2 transition-opacity ${query.isFetching && query.isPlaceholderData ? "opacity-60" : ""}`}>
            {items.map((a) => (
              <li key={a._id} className="flex">
                <AnnouncementCard a={a} onEdit={onEdit} onShowLog={onShowLog} />
              </li>
            ))}
          </ul>
          <Pagination page={page} limit={LIMIT} total={query.data.total} onPage={(p) => setUrl({ page: p })} className="mt-4 rounded-card bg-surface" />
        </>
      )}
    </>
  );
}

const panelFallback = (
  <Card>
    <SkeletonList rows={4} />
  </Card>
);

/** Announcements, automatic reminders and the log of everything sent to members. */
export default function AnnouncementsPage() {
  const [{ tab, status, page }, setUrl] = useUrlState(DEFAULTS);
  const canAnnounce = usePermission("announcements.manage");
  const canRemind = usePermission("reminders.manage");
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const tabs = [
    canAnnounce && { value: "announcements", label: "Announcements" },
    canRemind && { value: "reminders", label: "Automatic reminders" },
    canRemind && { value: "log", label: "Sent log" },
  ].filter(Boolean);
  const current = tabs.find((t) => t.value === tab) ? tab : tabs[0]?.value;

  if (!tabs.length) {
    return (
      <>
        <PageHeader title="Announcements" />
        <Card>
          <ErrorState error={{ status: 403, message: "Ask the owner or a manager to post announcements." }} />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Announcements"
        description="Tell members about events, offers and holidays, and see every reminder and message they were sent."
        actions={
          canAnnounce &&
          current === "announcements" && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              New announcement
            </Button>
          )
        }
      />
      <Tabs label="Announcements sections" value={current} onChange={(t) => setUrl({ tab: t, status: "all", page: 1 })} tabs={tabs} className="mb-5" />
      <div role="tabpanel" id={`panel-${current}`} aria-labelledby={`tab-${current}`}>
        {current === "announcements" && (
          <AnnouncementsList
            status={status}
            page={page}
            setUrl={setUrl}
            onCreate={() => setCreating(true)}
            onEdit={setEditing}
            onShowLog={canRemind ? () => setUrl({ tab: "log", status: "all", page: 1 }) : undefined}
          />
        )}
        {current === "reminders" && (
          <Suspense fallback={panelFallback}>
            <RemindersPanel />
          </Suspense>
        )}
        {current === "log" && (
          <Suspense fallback={panelFallback}>
            <NotificationLog source="all" title="Sent log" description="Every reminder, announcement and message sent to members, and how each one was delivered." />
          </Suspense>
        )}
      </div>
      {canAnnounce && <AnnouncementDialog open={creating || Boolean(editing)} announcement={editing} onClose={() => (setCreating(false), setEditing(null))} />}
    </>
  );
}
