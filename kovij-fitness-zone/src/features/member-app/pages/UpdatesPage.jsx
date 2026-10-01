import { useNavigate, useSearchParams } from "react-router-dom";
import { Bell, CalendarClock, CheckCheck, Dumbbell, Gift, LifeBuoy, Megaphone, MessageSquare, Wallet } from "lucide-react";
import { useAnnouncements, useMarkAllRead, useMarkRead, useNotifications } from "../queries";
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, SkeletonList, Tabs } from "../../../shared/ui";
import { formatRelativeTime } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

const KIND_ICON = { membership: CalendarClock, reminder: CalendarClock, payment: Wallet, workout: Dumbbell, diet: Dumbbell, announcement: Megaphone, birthday: Gift, message: MessageSquare, support: LifeBuoy };
const CATEGORY = { event: "Event", offer: "Offer", holiday: "Holiday", notice: "Notice" };

/** Only links inside the member app are followed. */
const appPath = (link) => (typeof link === "string" && link.startsWith("/member/") ? link.replace(/^\/member\/dashboard$/, "/member/home") : null);

export default function UpdatesPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "gym" ? "gym" : "you";
  return (
    <>
      <PageHeader title="Updates" />
      <Tabs
        label="Updates"
        value={tab}
        onChange={(t) => setParams(t === "gym" ? { tab: "gym" } : {}, { replace: true })}
        tabs={[
          { value: "you", label: "For you" },
          { value: "gym", label: "From the gym" },
        ]}
        className="mb-4"
      />
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === "gym" ? <Announcements /> : <ForYou />}
      </div>
    </>
  );
}

function ForYou() {
  const list = useNotifications();
  const markAll = useMarkAllRead();
  const markOne = useMarkRead();
  const navigate = useNavigate();
  const data = list.data;

  const open = (n) => {
    if (!n.readAt) markOne.mutate(n._id);
    const to = appPath(n.link);
    if (to) navigate(to);
  };

  if (list.isPending) return <Card><SkeletonList rows={5} /></Card>;
  if (list.isError) return <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>;
  if (!data.items.length) return <Card><EmptyState icon={Bell} title="Nothing yet" body="Plan reminders, replies from the gym and new workout or diet plans show up here." /></Card>;

  return (
    <div className="flex flex-col gap-3">
      {data.unread > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="ghost" icon={CheckCheck} onClick={() => markAll.mutate()} loading={markAll.isPending}>
            Mark all as read
          </Button>
        </div>
      )}
      <Card padding="none" className="overflow-hidden">
        <ul className="divide-y divide-line">
          {data.items.map((n) => {
            const Icon = KIND_ICON[n.kind] || Bell;
            const unread = !n.readAt;
            return (
              <li key={n._id}>
                <button type="button" onClick={() => open(n)} className={cn("flex w-full gap-3 p-4 text-left hover:bg-surface-2", unread && "bg-brand-soft/30")}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className={cn("text-[15px]", unread ? "font-bold" : "font-semibold")}>{n.title}</span>
                      {unread && <span className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
                    </span>
                    {n.body && <span className="mt-0.5 line-clamp-3 block text-sm text-ink-2">{n.body}</span>}
                    <span className="mt-1 block text-[12px] text-ink-3">{formatRelativeTime(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}

function Announcements() {
  const list = useAnnouncements();
  if (list.isPending) return <Card><SkeletonList rows={4} /></Card>;
  if (list.isError) return <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>;
  if (!list.data.items.length) return <Card><EmptyState icon={Megaphone} title="No news right now" body="Events, offers and holiday timings from the gym appear here." /></Card>;
  return (
    <ul className="flex flex-col gap-3">
      {list.data.items.map((a) => (
        <li key={a._id}>
          <Card padding="none" className="overflow-hidden">
            {a.imageUrl && <img src={a.imageUrl} alt="" className="aspect-[2/1] w-full object-cover" loading="lazy" />}
            <div className="p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                {a.category && <Badge size="sm" tone={a.category === "offer" ? "brand" : "neutral"}>{CATEGORY[a.category] || a.category}</Badge>}
                {a.pinned && <Badge size="sm">Pinned</Badge>}
                <span className="text-[12px] text-ink-3">{formatRelativeTime(a.publishAt)}</span>
              </div>
              <h2 className="text-[17px] font-bold">{a.title}</h2>
              <p className="mt-1 whitespace-pre-line text-[15px] text-ink-2">{a.body}</p>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
