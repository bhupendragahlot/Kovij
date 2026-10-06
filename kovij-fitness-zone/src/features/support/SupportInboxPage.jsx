import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CircleCheck, Inbox, LifeBuoy, MessageCircle, Phone, Send, UserCheck } from "lucide-react";
import { useSelector } from "react-redux";
import { useSupportInbox, useSupportReply, useSupportTicket, useUpdateSupport } from "./api";
import { QUICK_REPLIES, SUPPORT_CATEGORY, SUPPORT_STATUS } from "./labels";
import { selectStaffUser } from "../auth/sessionSlice";
import { useUrlState } from "../../shared/hooks/useUrlState";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import {
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  FilterChips,
  FormError,
  InlineAlert,
  PageHeader,
  Pagination,
  SearchInput,
  Select,
  SkeletonList,
  StatusBadge,
  Switch,
  Textarea,
  useToast,
} from "../../shared/ui";
import { formatDateTime, formatPhone, formatRelativeTime, phoneHref } from "../../shared/lib/format";
import { cn } from "../../shared/lib/cn";

const LIMIT = 25;
const DEFAULTS = { status: "open", q: "", mine: "", id: "", page: 1 };

/** OWNER: member app content & support module. /admin/support */
export default function SupportInboxPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  useEffect(() => {
    const t = setTimeout(() => search !== filters.q && setFilters({ q: search }), 300);
    return () => clearTimeout(t);
  }, [search, filters.q, setFilters]);

  const query = useSupportInbox({ status: filters.status, q: filters.q, assigned: filters.mine ? "me" : "any", page: filters.page, limit: LIMIT });
  const data = query.data;
  const counts = data?.counts;
  const chips = [
    { value: "open", label: "Needs reply", count: counts?.open },
    { value: "waiting_member", label: "Waiting on member", count: counts?.waiting_member },
    { value: "resolved", label: "Resolved", count: counts?.resolved },
    { value: "closed", label: "Closed", count: counts?.closed },
    { value: "all", label: "All" },
  ];
  const open = (id) => setFilters({ id, page: filters.page });

  return (
    <>
      <PageHeader
        title="Support inbox"
        description={counts ? (counts.unread ? `${counts.unread} new from members` : "Questions and problems members send from the app.") : "Questions and problems members send from the app."}
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(20rem,26rem)_1fr]">
        {/* Phones show either the list or one conversation. */}
        <section aria-label="Requests" className={cn(filters.id && "max-lg:hidden")}>
          <div className="mb-3 flex flex-col gap-3">
            <SearchInput value={search} onChange={setSearch} placeholder="Member, subject or #number" label="Search requests" />
            <div className="flex items-center justify-between gap-3">
              <FilterChips label="Status" value={filters.status} onChange={(status) => setFilters({ status, id: "" })} options={chips} className="min-w-0" />
            </div>
            <Switch label="Only mine" description="Requests assigned to you" checked={Boolean(filters.mine)} onChange={(v) => setFilters({ mine: v ? "1" : "" })} />
          </div>
          <Card padding="none" className="overflow-hidden">
            {query.isPending ? (
              <SkeletonList rows={6} className="p-4" />
            ) : query.isError && !data ? (
              <ErrorState compact error={query.error} onRetry={() => query.refetch()} />
            ) : !data.items.length ? (
              <EmptyState
                compact
                icon={filters.status === "open" ? CircleCheck : Inbox}
                title={filters.q ? "No requests match" : filters.status === "open" ? "All caught up" : "Nothing here"}
                body={filters.q ? "Try another name or number." : filters.status === "open" ? "No member is waiting for a reply." : "Requests appear here when members send them from the app."}
              />
            ) : (
              <>
                <ul className={cn("divide-y divide-line transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
                  {data.items.map((t) => (
                    <TicketRow key={t.id} ticket={t} selected={t.id === filters.id} onOpen={() => open(t.id)} />
                  ))}
                </ul>
                <Pagination page={filters.page} limit={LIMIT} total={data.total} onPage={(page) => setFilters({ page })} />
              </>
            )}
          </Card>
        </section>

        <section aria-label="Conversation" className={cn(!filters.id && "max-lg:hidden")}>
          {filters.id ? (
            <Conversation key={filters.id} id={filters.id} onBack={() => setFilters({ id: "" })} />
          ) : (
            <Card className="grid min-h-80 place-items-center">
              <EmptyState icon={LifeBuoy} title="Pick a request" body="Open one on the left to read it and reply." />
            </Card>
          )}
        </section>
      </div>
    </>
  );
}

function TicketRow({ ticket, selected, onOpen }) {
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        aria-current={selected ? "true" : undefined}
        className={cn("flex w-full gap-3 px-4 py-3 text-left hover:bg-surface-2", selected && "bg-surface-2")}
      >
        <span className="relative shrink-0">
          <Avatar name={ticket.member?.name || "?"} src={ticket.member?.photo} />
          {ticket.unread && <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-surface bg-brand" aria-label="New" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className={cn("truncate", ticket.unread ? "font-bold" : "font-semibold")}>{ticket.member?.name || "Member"}</span>
            <time dateTime={ticket.lastMessageAt} className="shrink-0 text-label text-ink-3">
              {formatRelativeTime(ticket.lastMessageAt)}
            </time>
          </span>
          <span className={cn("block truncate text-sm", ticket.unread ? "text-ink" : "text-ink-2")}>{ticket.subject}</span>
          <span className="block truncate text-body-sm text-ink-3">
            {ticket.lastMessageBy === "staff" ? "You: " : ""}
            {ticket.preview}
          </span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            <StatusPill status={ticket.status} />
            <span className="text-label text-ink-3">
              {ticket.reference} · {SUPPORT_CATEGORY[ticket.category]}
            </span>
          </span>
        </span>
      </button>
    </li>
  );
}

function StatusPill({ status }) {
  const meta = SUPPORT_STATUS[status];
  return meta ? (
    <Badge size="sm" tone={meta.tone} icon={meta.icon}>
      {meta.label}
    </Badge>
  ) : null;
}

const contactClass = "inline-grid size-10 shrink-0 place-items-center rounded-control border border-line-strong text-ink-2 hover:bg-surface-2 hover:text-ink";

function Conversation({ id, onBack }) {
  const query = useSupportTicket(id);
  const me = useSelector(selectStaffUser);
  const reply = useSupportReply(id);
  const update = useUpdateSupport(id);
  const toast = useToast();
  const online = useOnlineStatus();
  const { keyFor, reset } = useIdempotencyKey();
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const t = query.data;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [t?.messages?.length]);

  if (query.isPending) return <Card><SkeletonList rows={5} /></Card>;
  if (query.isError) return <Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card>;

  const send = (status) => {
    const payload = { text: text.trim(), ...(status && { status }) };
    if (payload.text.length < 2) return;
    reply.mutate(
      { payload, idempotencyKey: keyFor(payload) },
      {
        onSuccess: () => {
          reset();
          setText("");
          toast.success(status === "resolved" ? "Replied and resolved" : "Reply sent", { description: `${t.member?.name || "The member"} is notified in the app and by email.` });
        },
      }
    );
  };
  const setStatus = (status) =>
    update.mutate({ status }, { onSuccess: () => toast.success(`Marked ${SUPPORT_STATUS[status].label.toLowerCase()}`), onError: (e) => toast.error("Couldn't update", { description: e.message }) });
  const assignToMe = () => update.mutate({ assignedTo: me.id }, { onSuccess: () => toast.success("Assigned to you") });
  const closed = t.status === "closed";

  return (
    <Card padding="none" className="flex flex-col overflow-hidden">
      <header className="flex flex-wrap items-start gap-3 border-b border-line p-4 md:p-5">
        <button type="button" onClick={onBack} aria-label="Back to requests" className="grid size-10 place-items-center rounded-full text-ink-2 hover:bg-surface-2 lg:hidden">
          <ArrowLeft className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-body-sm text-ink-3">
            {t.reference} · {SUPPORT_CATEGORY[t.category]} · opened {formatRelativeTime(t.createdAt)}
          </p>
          <h2 className="text-title-lg font-bold leading-snug">{t.subject}</h2>
          {t.member && (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Link to={`/admin/members/${t.member.id}`} className="inline-flex items-center gap-2 font-semibold hover:underline">
                <Avatar name={t.member.name} src={t.member.photo} size="sm" />
                {t.member.name}
              </Link>
              <StatusBadge kind="member" status={t.member.state} size="sm" />
              {t.member.planName && <span className="text-body-sm text-ink-3">{t.member.planName}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {t.member?.phone && (
            <>
              <a href={phoneHref(t.member.phone)} aria-label={`Call ${t.member.name}`} title={`Call ${formatPhone(t.member.phone)}`} className={contactClass}>
                <Phone className="size-[18px]" aria-hidden />
              </a>
              <a href={phoneHref(t.member.phone, "whatsapp")} target="_blank" rel="noreferrer" aria-label={`WhatsApp ${t.member.name}`} className={contactClass}>
                <MessageCircle className="size-[18px]" aria-hidden />
              </a>
            </>
          )}
        </div>
        <div className="flex w-full flex-wrap items-center gap-2">
          <StatusPill status={t.status} />
          <span className="text-body-sm text-ink-3">{t.assignedTo ? `Handled by ${t.assignedTo.id === me?.id ? "you" : t.assignedTo.name}` : "Not assigned"}</span>
          {t.assignedTo?.id !== me?.id && (
            <Button size="sm" variant="ghost" icon={UserCheck} onClick={assignToMe} loading={update.isPending && update.variables?.assignedTo}>
              Assign to me
            </Button>
          )}
          <div className="ml-auto">
            <label className="sr-only" htmlFor={`status-${id}`}>
              Change status
            </label>
            <Select id={`status-${id}`} value={t.status} onChange={(e) => setStatus(e.target.value)} className="h-9 w-auto text-sm md:h-9">
              {Object.entries(SUPPORT_STATUS).map(([value, s]) => (
                <option key={value} value={value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </header>

      <ol className="flex max-h-[55vh] min-h-64 flex-col gap-3 overflow-y-auto bg-surface-2/40 p-4 md:p-5" aria-label="Messages">
        {t.messages.map((m) => (
          <li key={m.id} className={cn("flex max-w-[85%] flex-col", m.by === "staff" ? "self-end items-end" : "self-start items-start")}>
            <div className={cn("whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-body-lg leading-relaxed", m.by === "staff" ? "rounded-br-[6px] bg-brand-soft text-ink" : "rounded-bl-[6px] bg-surface text-ink shadow-sm")}>{m.text}</div>
            <p className="mt-1 text-label text-ink-3">
              {m.author} · <time dateTime={m.at} title={formatDateTime(m.at)}>{formatRelativeTime(m.at)}</time>
            </p>
          </li>
        ))}
        <li ref={endRef} aria-hidden />
      </ol>

      <footer className="border-t border-line p-4 md:p-5">
        {closed ? (
          <InlineAlert tone="info">This request is closed. Reopen it with the status menu if you need to reply.</InlineAlert>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex flex-col gap-3"
          >
            <FormError error={reply.error} />
            {!online && <InlineAlert tone="warn">You’re offline. Reconnect to send your reply; what you’ve typed stays here.</InlineAlert>}
            <div className="flex flex-wrap gap-1.5" aria-label="Quick replies">
              {QUICK_REPLIES.map((q) => (
                <button key={q.label} type="button" onClick={() => setText(q.text)} className="rounded-full border border-line-strong px-3 py-1 text-body-sm font-semibold text-ink-2 hover:bg-surface-2">
                  {q.label}
                </button>
              ))}
            </div>
            <label className="sr-only" htmlFor={`reply-${id}`}>
              Reply to {t.member?.name || "the member"}
            </label>
            <Textarea id={`reply-${id}`} rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder={`Reply to ${t.member?.name?.split(" ")[0] || "the member"}…`} />
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" icon={CircleCheck} onClick={() => send("resolved")} disabled={text.trim().length < 2 || !online} loading={reply.isPending && reply.variables?.payload?.status === "resolved"}>
                Send and resolve
              </Button>
              <Button type="submit" variant="primary" icon={Send} disabled={text.trim().length < 2 || !online} loading={reply.isPending && !reply.variables?.payload?.status}>
                Send reply
              </Button>
            </div>
          </form>
        )}
      </footer>
    </Card>
  );
}
