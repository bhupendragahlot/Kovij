import { useEffect, useState } from "react";
import { MessageSquareText } from "lucide-react";
import { useMemberChannels, useSendMemberMessage } from "./api";
import { DeliveryBadges } from "../notifications/components";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, Select, Skeleton, Switch, Textarea, useToast } from "../../shared/ui";
import { formatDate, formatINR, formatRelativeTime } from "../../shared/lib/format";

const BODY_MAX = 2000;
const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";

/** Starting points for common messages; staff edit them before sending. */
function templates(member) {
  const first = firstName(member.name);
  const plan = member.current?.planName || "membership";
  const ends = member.current?.endDate ? formatDate(member.current.endDate) : "soon";
  return {
    custom: { label: "Write my own", title: "", body: "" },
    payment_reminder: {
      label: "Payment reminder",
      title: "Payment reminder",
      body: `Hi ${first}, a friendly reminder that ${member.dues > 0 ? formatINR(member.dues) : "a payment"} is due at the gym. You can pay at the front desk or in the app. Thank you!`,
    },
    plan_ending: {
      label: "Plan ending soon",
      title: "Your plan is ending soon",
      body: `Hi ${first}, your ${plan} plan ends on ${ends}. Renew at the front desk or in the app to keep training without a break.`,
    },
    we_miss_you: {
      label: "We miss you",
      title: "We miss you at the gym",
      body: `Hi ${first}, we haven't seen you in a while. Come back this week, and talk to us at the desk if anything is stopping you. We'd love to help.`,
    },
    plan_renewed: {
      label: "Plan renewed",
      title: "Your plan is renewed",
      body: `Hi ${first}, your ${plan} plan is renewed. Thank you for training with us!`,
    },
  };
}

function channelHint(channels, kind) {
  if (!channels) return "Checking…";
  if (kind === "email") {
    if (!channels.email.available) return "No email on file. Add one in the member's details.";
    if (channels.email.optedOut) return "They turned off emails in the app.";
    return "Sent to the email on file.";
  }
  if (!channels.push.configured) return "Phone notifications aren't set up on the server yet.";
  if (channels.push.optedOut) return "They turned off phone notifications.";
  if (!channels.push.devices) return "They haven't turned on notifications in the app.";
  return channels.push.devices === 1 ? "To their phone." : `To their ${channels.push.devices} devices.`;
}

/** Member profile header action: send this member a message (always in the app; email and phone when possible). */
export default function MemberMessageAction({ member }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ template: "custom", title: "", body: "", email: true, push: true });
  const channels = useMemberChannels(member._id, { enabled: open });
  const send = useSendMemberMessage();
  const idempotency = useIdempotencyKey();
  const toast = useToast();
  const online = useOnlineStatus();
  const c = channels.data;
  const canEmail = Boolean(c?.email.available && !c.email.optedOut);
  const canPush = Boolean(c?.push.configured && !c.push.optedOut && c.push.devices > 0);
  const list = templates(member);

  useEffect(() => {
    if (!open) return;
    setForm({ template: "custom", title: "", body: "", email: true, push: true });
    send.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = send.error?.fields || {};

  const pickTemplate = (key) => {
    const t = list[key];
    set({ template: key, ...(key === "custom" ? {} : { title: t.title, body: t.body }) });
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      memberId: member._id,
      title: form.title.trim(),
      body: form.body.trim(),
      email: canEmail && form.email,
      push: canPush && form.push,
      template: form.template,
    };
    send.mutate(
      { payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: (res) => {
          idempotency.reset();
          const ch = res.notification.channels || {};
          const ways = ["in the app", ch.email?.status === "queued" || ch.email?.status === "sent" ? "by email" : null, ch.push?.status === "sent" ? "to their phone" : null].filter(Boolean);
          toast.success("Message sent", { description: `${firstName(member.name)} gets it ${ways.join(", ")}.` });
          setOpen(false);
        },
      }
    );
  };

  return (
    <>
      <Button variant="secondary" icon={MessageSquareText} onClick={() => setOpen(true)}>
        Message
      </Button>
      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title={`Message ${firstName(member.name)}`}
        description="They see it in the member app. You can also email it or send it to their phone."
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="member-message" variant="primary" loading={send.isPending} disabled={!online}>
              Send message
            </Button>
          </>
        }
      >
        <FormError error={send.error} />
        {!online && (
          <InlineAlert tone="offline" className="mb-4">
            You're offline. You can keep writing; sending works when the connection is back.
          </InlineAlert>
        )}
        <form id="member-message" onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <Field label="Start from">
            <Select value={form.template} onChange={(e) => pickTemplate(e.target.value)}>
              {Object.entries(list).map(([key, t]) => (
                <option key={key} value={key}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Subject" error={errors.title} required>
            <Input value={form.title} onChange={(e) => set({ title: e.target.value.replace(/[\r\n]/g, " ") })} maxLength={120} placeholder="e.g. Your locker key" />
          </Field>
          <Field label="Message" error={errors.body} required hint={`${form.body.length}/${BODY_MAX}`}>
            <Textarea value={form.body} onChange={(e) => set({ body: e.target.value })} rows={5} maxLength={BODY_MAX} />
          </Field>

          <fieldset className="flex flex-col gap-4 rounded-tile bg-surface-2 p-4">
            <legend className="sr-only">How to send it</legend>
            {channels.isPending ? (
              <>
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </>
            ) : channels.isError ? (
              <p className="text-sm text-ink-2">
                Couldn't check email and phone for this member. The message still reaches them in the app.{" "}
                <button type="button" className="font-semibold text-brand-ink hover:underline" onClick={() => channels.refetch()}>
                  Try again
                </button>
              </p>
            ) : (
              <>
                <Switch checked={canEmail && form.email} onChange={(email) => set({ email })} disabled={!canEmail} label="Also email it" description={channelHint(c, "email")} />
                <Switch checked={canPush && form.push} onChange={(push) => set({ push })} disabled={!canPush} label="Also send to their phone" description={channelHint(c, "push")} />
              </>
            )}
          </fieldset>

          {c?.recent?.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-semibold text-ink">Recently sent to {firstName(member.name)}</summary>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {c.recent.slice(0, 5).map((n) => (
                  <li key={n._id} className="py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="min-w-0 font-semibold text-ink">{n.title}</p>
                      <span className="shrink-0 text-[13px] text-ink-3">{formatRelativeTime(n.createdAt)}</span>
                    </div>
                    <p className="text-[13px] text-ink-3">{n.sentBy ? `By ${n.sentBy}` : "Automatic"}</p>
                    <DeliveryBadges notification={n} className="mt-1.5 flex flex-wrap gap-1.5" />
                  </li>
                ))}
              </ul>
            </details>
          )}
        </form>
      </Dialog>
    </>
  );
}
