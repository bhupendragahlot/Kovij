import { useEffect, useMemo, useState } from "react";
import { FlaskConical, Megaphone, Plus, Send } from "lucide-react";
import { useSelector } from "react-redux";
import { useAudienceCount, useCampaigns, useCreateCampaign, useSendCampaign, useTestCampaign } from "./api";
import { selectStaffUser } from "../auth/sessionSlice";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FormError,
  Input,
  PageHeader,
  Select,
  SkeletonList,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { formatDate, formatNumber } from "../../shared/lib/format";

const TYPES = { offer: "Offer", festival: "Festival greeting", info: "Announcement", bulk: "General" };
const AUDIENCES = {
  all: "Everyone with an email",
  activeMembers: "Members with an active plan",
  expired: "Lapsed members (had a plan, none now)",
  noMembership: "Signed up but never bought a plan",
};
const STATUS = { draft: { tone: "neutral", label: "Draft" }, sending: { tone: "info", label: "Sending" }, sent: { tone: "good", label: "Sent" }, failed: { tone: "bad", label: "Failed" } };
const EMPTY = { title: "", type: "offer", audienceFilter: "activeMembers", subject: "", bodyHtml: "<p>Hi {{firstName}},</p>\n<p></p>\n<p>See you at the gym,<br>{{gym}}</p>" };

/** Render placeholders the way the server will, for the preview only. */
function fillPreview(html) {
  return html.replace(/\{\{\s*firstName\s*\}\}/g, "Priya").replace(/\{\{\s*name\s*\}\}/g, "Priya Sharma").replace(/\{\{\s*gym\s*\}\}/g, "Kovij Fitness Zone");
}

function Composer({ open, onClose }) {
  const create = useCreateCampaign();
  const toast = useToast();
  const [form, setForm] = useState(EMPTY);
  const audience = useAudienceCount(open ? form.audienceFilter : null);
  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = create.error?.fields || {};

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      create.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const preview = useMemo(
    () => `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#15171a;margin:16px">${fillPreview(form.bodyHtml)}</body></html>`,
    [form.bodyHtml]
  );

  const insert = (token) => set({ bodyHtml: `${form.bodyHtml}${token}` });

  const submit = (e) => {
    e.preventDefault();
    create.mutate(form, { onSuccess: () => (toast.success("Draft saved", { description: "Send a test to yourself before sending to members." }), onClose()) });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="New campaign"
      placement="side"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="campaign-form" variant="primary" loading={create.isPending}>
            Save draft
          </Button>
        </>
      }
    >
      <FormError error={create.error} />
      <form id="campaign-form" onSubmit={submit} className="grid grid-cols-1 gap-4 lg:grid-cols-2" noValidate>
        <div className="flex flex-col gap-4">
          <Field label="Internal name" error={errors.title} required hint="Only staff see this.">
            <Input value={form.title} onChange={(e) => set({ title: e.target.value })} placeholder="Diwali offer 2026" />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Type" error={errors.type}>
              <Select value={form.type} onChange={(e) => set({ type: e.target.value })}>
                {Object.entries(TYPES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Send to" error={errors.audienceFilter} hint={audience.data != null ? `${formatNumber(audience.data)} recipients` : "Counting…"}>
              <Select value={form.audienceFilter} onChange={(e) => set({ audienceFilter: e.target.value })}>
                {Object.entries(AUDIENCES).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Email subject" error={errors.subject} required>
            <Input value={form.subject} onChange={(e) => set({ subject: e.target.value })} placeholder="{{firstName}}, 20% off this Diwali" maxLength={200} />
          </Field>
          <Field
            label="Message"
            error={errors.bodyHtml}
            required
            hint="Basic HTML is allowed. Placeholders are filled in for each member."
            labelAction={
              <span className="flex gap-1">
                {["{{firstName}}", "{{gym}}"].map((t) => (
                  <button key={t} type="button" onClick={() => insert(t)} className="rounded-[6px] bg-surface-2 px-1.5 py-0.5 text-xs font-semibold text-ink-2 hover:bg-surface-3">
                    + {t.replace(/[{}]/g, "")}
                  </button>
                ))}
              </span>
            }
          >
            <Textarea value={form.bodyHtml} onChange={(e) => set({ bodyHtml: e.target.value })} rows={12} className="font-mono text-[13px]" />
          </Field>
        </div>
        <div className="flex min-h-80 flex-col">
          <p className="mb-1.5 text-sm font-semibold">Preview</p>
          <div className="flex-1 overflow-hidden rounded-tile border border-line bg-white">
            <p className="border-b border-line bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              <span className="font-semibold text-ink">Subject:</span> {fillPreview(form.subject) || "No subject yet"}
            </p>
            {/* sandbox="" disables scripts, forms and navigation inside the preview */}
            <iframe title="Email preview" sandbox="" srcDoc={preview} className="h-full min-h-72 w-full" />
          </div>
        </div>
      </form>
    </Dialog>
  );
}

function TestDialog({ campaign, onClose }) {
  const user = useSelector(selectStaffUser);
  const test = useTestCampaign();
  const toast = useToast();
  const [to, setTo] = useState("");
  useEffect(() => {
    setTo(user?.email || "");
    test.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaign?._id]);
  return (
    <Dialog
      open={Boolean(campaign)}
      onClose={onClose}
      title="Send a test"
      description="See exactly what members will receive."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            icon={FlaskConical}
            loading={test.isPending}
            onClick={() => test.mutate({ id: campaign._id, to }, { onSuccess: () => (toast.success(`Test sent to ${to}`), onClose()) })}
          >
            Send test
          </Button>
        </>
      }
    >
      <FormError error={test.error} />
      <Field label="Send to" error={test.error?.fields?.to}>
        <Input type="email" value={to} onChange={(e) => setTo(e.target.value)} />
      </Field>
    </Dialog>
  );
}

export default function CampaignsPage() {
  const campaigns = useCampaigns();
  const send = useSendCampaign();
  const confirm = useConfirm();
  const toast = useToast();
  const [composing, setComposing] = useState(false);
  const [testing, setTesting] = useState(null);

  const onSend = async (c) => {
    const ok = await confirm({
      title: `Send “${c.title}”?`,
      body: `It goes to: ${AUDIENCES[c.audienceFilter]}. Emails can't be recalled once sent.`,
      confirmLabel: "Send now",
    });
    if (!ok) return;
    send.mutate(c._id, {
      onSuccess: (d) => toast.success(`Sending to ${formatNumber(d.queued)} members`, { description: "Delivery results update below as emails go out." }),
      onError: (e) => toast.error("Couldn't send", { description: e.message }),
    });
  };

  return (
    <>
      <PageHeader
        title="Campaigns"
        description="Email offers and announcements to members."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setComposing(true)}>
            New campaign
          </Button>
        }
      />
      <Card padding="none">
        {campaigns.isPending ? (
          <SkeletonList rows={4} className="p-5" />
        ) : campaigns.isError ? (
          <ErrorState error={campaigns.error} onRetry={() => campaigns.refetch()} />
        ) : campaigns.data.length === 0 ? (
          <EmptyState icon={Megaphone} title="No campaigns yet" body="Write an offer or a festival greeting, test it on yourself, then send it to the members you choose." action={<Button variant="primary" icon={Plus} onClick={() => setComposing(true)}>New campaign</Button>} />
        ) : (
          <ul className="divide-y divide-line">
            {campaigns.data.map((c) => {
              const s = STATUS[c.status] || STATUS.draft;
              return (
                <li key={c._id} className="flex flex-col gap-3 px-4 py-4 md:flex-row md:items-center md:px-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold">{c.title}</p>
                      <Badge size="sm" tone={s.tone}>
                        {s.label}
                      </Badge>
                      <Badge size="sm">{TYPES[c.type]}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-ink-3">
                      {AUDIENCES[c.audienceFilter]}, created {formatDate(c.createdAt)}
                    </p>
                    {c.status !== "draft" && (
                      <p className="mt-1 text-[13px] text-ink-2">
                        {formatNumber(c.stats.sent)} delivered
                        {c.stats.failed ? `, ${formatNumber(c.stats.failed)} failed` : ""}
                        {c.stats.queued ? `, ${formatNumber(c.stats.queued)} waiting` : ""}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" icon={FlaskConical} onClick={() => setTesting(c)}>
                      Test
                    </Button>
                    {c.status === "draft" || c.status === "failed" ? (
                      <Button size="sm" variant="primary" icon={Send} onClick={() => onSend(c)} loading={send.isPending && send.variables === c._id}>
                        Send
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <Composer open={composing} onClose={() => setComposing(false)} />
      <TestDialog campaign={testing} onClose={() => setTesting(null)} />
    </>
  );
}
