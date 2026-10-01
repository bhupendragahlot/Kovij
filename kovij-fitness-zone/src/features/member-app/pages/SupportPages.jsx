import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { CircleCheck, LifeBuoy, Plus, Send } from "lucide-react";
import { useMyTicket, useMyTickets, useOpenTicket, useReplyTicket, useResolveTicket } from "../queries";
import { SUPPORT_CATEGORY, SUPPORT_STATUS_MEMBER } from "../../support/labels";
import { useIdempotencyKey } from "../../../shared/hooks/useIdempotencyKey";
import { Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Field, FormError, InlineAlert, Input, PageHeader, Select, SkeletonList, Textarea, useToast } from "../../../shared/ui";
import { formatDateTime, formatRelativeTime } from "../../../shared/lib/format";
import { cn } from "../../../shared/lib/cn";

function StatusPill({ status }) {
  const s = SUPPORT_STATUS_MEMBER[status];
  return s ? (
    <Badge size="sm" tone={s.tone} icon={s.icon}>
      {s.label}
    </Badge>
  ) : null;
}

/** /member/support */
export function SupportListPage() {
  const list = useMyTickets();
  return (
    <>
      <PageHeader
        title="Help"
        description="Ask the gym anything: payments, your plan, check-in, equipment. They reply here."
        actions={
          <ButtonLink to="/member/support/new" variant="primary" icon={Plus}>
            New question
          </ButtonLink>
        }
      />
      {list.isPending ? (
        <Card><SkeletonList rows={3} /></Card>
      ) : list.isError ? (
        <Card><ErrorState error={list.error} onRetry={() => list.refetch()} /></Card>
      ) : !list.data.items.length ? (
        <Card>
          <EmptyState icon={LifeBuoy} title="No questions yet" body="Write to the gym from here. You’ll get a notification when they reply." action={<ButtonLink to="/member/support/new" variant="primary">Ask a question</ButtonLink>} />
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-line">
            {list.data.items.map((t) => (
              <li key={t.id}>
                <Link to={`/member/support/${t.id}`} className={cn("block p-4 hover:bg-surface-2", t.unread && "bg-brand-soft/30")}>
                  <span className="flex items-start justify-between gap-2">
                    <span className={cn("text-[15px]", t.unread ? "font-bold" : "font-semibold")}>{t.subject}</span>
                    <span className="shrink-0 text-[12px] text-ink-3">{formatRelativeTime(t.lastMessageAt)}</span>
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-sm text-ink-2">
                    {t.lastAuthor && t.lastAuthor !== "You" ? `${t.lastAuthor}: ` : ""}
                    {t.preview}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <StatusPill status={t.status} />
                    <span className="text-[12px] text-ink-3">{t.reference}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

/** /member/support/new */
export function NewSupportPage() {
  const open = useOpenTicket();
  const navigate = useNavigate();
  const toast = useToast();
  const { keyFor, reset } = useIdempotencyKey();
  const [form, setForm] = useState({ category: "other", subject: "", message: "" });
  const errors = open.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = { ...form, subject: form.subject.trim(), message: form.message.trim() };
    open.mutate(
      { payload, idempotencyKey: keyFor(payload) },
      {
        onSuccess: (data) => {
          reset();
          toast.success("Sent to the gym", { description: "You’ll get a notification when they reply." });
          navigate(`/member/support/${data.ticket.id}`, { replace: true });
        },
      }
    );
  };

  return (
    <>
      <PageHeader title="Ask the gym" back={{ to: "/member/support", label: "Help" }} />
      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormError error={Object.keys(errors).length ? null : open.error} />
          <Field label="What’s it about?" error={errors.category}>
            <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              {Object.entries(SUPPORT_CATEGORY).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" error={errors.subject}>
            <Input value={form.subject} maxLength={140} placeholder="e.g. Paid by UPI but it still shows due" onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </Field>
          <Field label="Message" error={errors.message} hint="Add details the desk needs: dates, amounts, the UPI reference.">
            <Textarea rows={5} value={form.message} maxLength={4000} onChange={(e) => setForm({ ...form, message: e.target.value })} />
          </Field>
          <Button type="submit" variant="primary" size="lg" icon={Send} loading={open.isPending} disabled={form.subject.trim().length < 3 || form.message.trim().length < 2}>
            Send
          </Button>
        </form>
      </Card>
    </>
  );
}

/** /member/support/:id */
export function SupportThreadPage() {
  const { id } = useParams();
  const query = useMyTicket(id);
  const reply = useReplyTicket(id);
  const resolve = useResolveTicket(id);
  const toast = useToast();
  const { keyFor, reset } = useIdempotencyKey();
  const [text, setText] = useState("");
  const endRef = useRef(null);
  const t = query.data?.ticket;

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [t?.messages?.length]);

  if (query.isPending) return <><PageHeader title="Help" back={{ to: "/member/support", label: "Help" }} /><Card><SkeletonList rows={4} /></Card></>;
  if (query.isError) return <><PageHeader title="Help" back={{ to: "/member/support", label: "Help" }} /><Card><ErrorState error={query.error} onRetry={() => query.refetch()} /></Card></>;

  const send = (e) => {
    e.preventDefault();
    const body = text.trim();
    if (body.length < 2) return;
    reply.mutate({ text: body, idempotencyKey: keyFor({ id, body }) }, { onSuccess: () => (reset(), setText("")) });
  };

  return (
    <>
      <PageHeader title={t.subject} description={`${t.reference} · ${SUPPORT_CATEGORY[t.category]}`} back={{ to: "/member/support", label: "Help" }} />
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <StatusPill status={t.status} />
        {(t.status === "open" || t.status === "waiting_member") && (
          <Button size="sm" variant="ghost" icon={CircleCheck} loading={resolve.isPending} onClick={() => resolve.mutate(undefined, { onSuccess: () => toast.success("Marked as sorted. Thanks!") })}>
            It’s sorted
          </Button>
        )}
      </div>
      <Card padding="none" className="overflow-hidden">
        <ol className="flex flex-col gap-3 bg-surface-2/40 p-4" aria-label="Messages">
          {t.messages.map((m) => (
            <li key={m.id} className={cn("flex max-w-[85%] flex-col", m.by === "member" ? "items-end self-end" : "items-start self-start")}>
              <div className={cn("whitespace-pre-wrap rounded-[16px] px-3.5 py-2.5 text-[15px] leading-relaxed", m.by === "member" ? "rounded-br-[6px] bg-brand-soft" : "rounded-bl-[6px] bg-surface shadow-sm")}>{m.text}</div>
              <p className="mt-1 text-[12px] text-ink-3">
                {m.by === "member" ? "You" : `${m.author} from the gym`} · <time dateTime={m.at} title={formatDateTime(m.at)}>{formatRelativeTime(m.at)}</time>
              </p>
            </li>
          ))}
          <li ref={endRef} aria-hidden />
        </ol>
        <div className="border-t border-line p-4">
          {t.canReply ? (
            <form onSubmit={send} className="flex flex-col gap-3">
              <FormError error={reply.error} />
              {t.status === "resolved" && <InlineAlert tone="info">This was marked sorted. Writing again reopens it.</InlineAlert>}
              <label htmlFor="member-reply" className="sr-only">
                Your reply
              </label>
              <Textarea id="member-reply" rows={3} value={text} maxLength={4000} onChange={(e) => setText(e.target.value)} placeholder="Write a reply…" />
              <Button type="submit" variant="primary" icon={Send} loading={reply.isPending} disabled={text.trim().length < 2} className="self-end">
                Send
              </Button>
            </form>
          ) : (
            <InlineAlert tone="info" action={<ButtonLink to="/member/support/new" size="sm">New question</ButtonLink>}>
              This conversation is closed. Start a new one if you still need help.
            </InlineAlert>
          )}
        </div>
      </Card>
    </>
  );
}
