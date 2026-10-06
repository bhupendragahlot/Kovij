import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Ban,
  CalendarClock,
  Ellipsis,
  Flame,
  Inbox,
  MessageCircle,
  Pencil,
  Phone,
  PhoneCall,
  Plus,
  RotateCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  StickyNote,
  Sunrise,
  Sunset,
  UserCheck,
  Zap,
} from "lucide-react";
import { useAddLeadNote, useConvertLead, useCreateLead, useLeads, useRetriageLead, useUpdateLead } from "./api";
import { useSellablePlans } from "../catalog/api";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { useUrlState } from "../../shared/hooks/useUrlState";
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  ErrorState,
  Field,
  FilterChips,
  FormError,
  IconButton,
  InlineAlert,
  Input,
  Menu,
  PageHeader,
  SearchInput,
  SegmentedControl,
  Select,
  SkeletonList,
  StatusBadge,
  Tabs,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { daysUntil, formatINR, formatRelativeDay, formatRelativeTime, formatShortDate, gymDayKey, phoneHref } from "../../shared/lib/format";
import { ENQUIRY_TOPIC, LEAD_SOURCE_LABEL } from "../../shared/domain/status";

const DEFAULTS = { status: "open", due: "", q: "", spam: "" };

/**
 * Labels from automatic sorting of the enquiry text. They're suggestions: shown quietly,
 * grouped under one accessible name, and never shown for a lead nobody wrote a message for.
 */
function TriageChips({ lead }) {
  const t = lead.triage;
  if (t?.status !== "done") return null;
  const topic = ENQUIRY_TOPIC[t.topic];
  const chips = [];
  if (t.spam) chips.push(<Badge key="spam" size="sm" tone="bad" icon={ShieldAlert}>Likely spam</Badge>);
  else if (t.spamProbability >= 0.5) chips.push(<Badge key="maybe" size="sm" tone="warn" icon={ShieldAlert}>Might be spam</Badge>);
  if (topic) chips.push(<Badge key="topic" size="sm" icon={topic.icon}>{topic.label}</Badge>);
  if (!t.spam && t.readinessLevel === "ready") chips.push(<Badge key="ready" size="sm" tone="brand" icon={Zap}>Ready to buy</Badge>);
  if (t.wantsCallback) chips.push(<Badge key="call" size="sm" tone="info" icon={PhoneCall}>Asked for a call</Badge>);
  if (t.timePref === "morning") chips.push(<Badge key="time" size="sm" icon={Sunrise}>Mornings</Badge>);
  if (t.timePref === "evening") chips.push(<Badge key="time" size="sm" icon={Sunset}>Evenings</Badge>);
  if (!chips.length) return null;
  return (
    <div role="group" aria-label="Sorted automatically from the message" title="Sorted automatically from the message" className="mt-3 flex flex-wrap gap-1.5">
      {chips}
    </div>
  );
}

/** "Tomorrow" etc. → an end-of-day ISO date the server stores as the next follow-up. */
function followUpDate(choice) {
  if (!choice || choice === "none") return null;
  const days = { tomorrow: 1, "3d": 3, week: 7 }[choice] ?? 0;
  return `${gymDayKey(new Date(Date.now() + days * 86_400_000))}T18:00:00+05:30`;
}

const FOLLOW_UP_OPTIONS = [
  { value: "tomorrow", label: "Tomorrow" },
  { value: "3d", label: "In 3 days" },
  { value: "week", label: "Next week" },
  { value: "none", label: "None" },
];

function LeadFormDialog({ open, onClose, lead }) {
  const plans = useSellablePlans();
  const create = useCreateLead();
  const update = useUpdateLead();
  const toast = useToast();
  const mutation = lead ? update : create;
  const empty = { name: "", phone: "", email: "", source: "walk_in", interestPlanId: "", followUp: "tomorrow", note: "" };
  const [form, setForm] = useState(empty);

  useEffect(() => {
    if (!open) return;
    mutation.reset();
    setForm(
      lead
        ? { name: lead.name, phone: lead.phone || "", email: lead.email || "", source: lead.source, interestPlanId: lead.interestPlanId?._id || "", followUp: "keep", note: "" }
        : empty
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const errors = mutation.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const base = {
      name: form.name,
      phone: form.phone || undefined,
      email: form.email || undefined,
      source: form.source,
      interestPlanId: form.interestPlanId || undefined,
    };
    if (lead) {
      update.mutate(
        { id: lead._id, patch: { ...base, interestPlanId: form.interestPlanId || null } },
        { onSuccess: () => (toast.success("Lead updated"), onClose()) }
      );
    } else {
      create.mutate(
        { ...base, nextFollowUpAt: followUpDate(form.followUp) || undefined, note: form.note || undefined },
        {
          onSuccess: (data) => {
            toast[data.memberMatches?.length ? "warning" : "success"](`${data.lead.name} added to leads`, {
              description: data.memberMatches?.length ? `Same phone as member ${data.memberMatches[0].name}. They may be a lapsed member.` : undefined,
            });
            onClose();
          },
        }
      );
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={lead ? "Edit lead" : "Add a lead"}
      description={lead ? undefined : "Someone who asked about joining. Follow up until they join or say no."}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="lead-form" variant="primary" loading={mutation.isPending}>
            {lead ? "Save lead" : "Add lead"}
          </Button>
        </>
      }
    >
      <FormError error={mutation.error} />
      <form id="lead-form" onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Field label="Name" error={errors.name} required className="sm:col-span-2">
          <Input value={form.name} onChange={(e) => set({ name: e.target.value })} maxLength={120} />
        </Field>
        <Field label="Phone" error={errors.phone} optional>
          <Input type="tel" inputMode="tel" value={form.phone} onChange={(e) => set({ phone: e.target.value })} maxLength={20} />
        </Field>
        <Field label="Email" error={errors.email} optional>
          <Input type="email" inputMode="email" value={form.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="How they found us" error={errors.source}>
          <Select value={form.source} onChange={(e) => set({ source: e.target.value })}>
            {Object.entries(LEAD_SOURCE_LABEL).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Interested in" optional error={errors.interestPlanId}>
          <Select value={form.interestPlanId} onChange={(e) => set({ interestPlanId: e.target.value })}>
            <option value="">Not sure yet</option>
            {(plans.data || []).map((p) => (
              <option key={p._id} value={p._id}>
                {p.name} ({formatINR(p.price)})
              </option>
            ))}
          </Select>
        </Field>
        {!lead && (
          <>
            <Field label="Follow up" className="sm:col-span-2">
              <SegmentedControl label="Follow up" block size="sm" value={form.followUp} onChange={(followUp) => set({ followUp })} options={FOLLOW_UP_OPTIONS} />
            </Field>
            <Field label="Note" optional className="sm:col-span-2">
              <Textarea value={form.note} onChange={(e) => set({ note: e.target.value })} rows={2} placeholder="e.g. Wants evening batch, asked about PT" />
            </Field>
          </>
        )}
      </form>
    </Dialog>
  );
}

function LogCallDialog({ lead, onClose }) {
  const addNote = useAddLeadNote();
  const update = useUpdateLead();
  const toast = useToast();
  const [text, setText] = useState("");
  const [followUp, setFollowUp] = useState("3d");

  useEffect(() => {
    setText("");
    setFollowUp("3d");
    addNote.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?._id]);

  const submit = async (e) => {
    e.preventDefault();
    try {
      await addNote.mutateAsync({ id: lead._id, text });
      await update.mutateAsync({ id: lead._id, patch: { nextFollowUpAt: followUpDate(followUp) } });
      toast.success("Call logged", { description: followUp === "none" ? "No follow-up set" : `Next follow-up ${formatRelativeDay(followUpDate(followUp))}` });
      onClose();
    } catch {
      /* error shown in the form */
    }
  };

  return (
    <Dialog
      open={Boolean(lead)}
      onClose={onClose}
      title={`Log a call with ${lead?.name?.split(" ")[0] || "lead"}`}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" form="log-call" variant="primary" loading={addNote.isPending || update.isPending}>
            Save note
          </Button>
        </>
      }
    >
      <FormError error={addNote.error || update.error} />
      <form id="log-call" onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <Field label="What happened" error={addNote.error?.fields?.text}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="e.g. Coming for a trial on Saturday" autoFocus />
        </Field>
        <Field label="Next follow-up">
          <SegmentedControl label="Next follow-up" block size="sm" value={followUp} onChange={setFollowUp} options={FOLLOW_UP_OPTIONS} />
        </Field>
      </form>
    </Dialog>
  );
}

function LeadCard({ lead, onEdit, onLog, triageEnabled }) {
  const navigate = useNavigate();
  const update = useUpdateLead();
  const convert = useConvertLead();
  const retriage = useRetriageLead();
  const confirm = useConfirm();
  const toast = useToast();
  const due = lead.nextFollowUpAt ? daysUntil(lead.nextFollowUpAt) : null;
  const open = ["new", "contacted", "trial"].includes(lead.status);
  const lastNote = lead.notes?.[lead.notes.length - 1];
  const tel = phoneHref(lead.phone);
  const wa = phoneHref(lead.phone, "whatsapp");

  const move = (status, extra = {}) =>
    update.mutate(
      { id: lead._id, patch: { status, ...extra } },
      { onError: (e) => toast.error("Couldn't update the lead", { description: e.message }) }
    );

  const onConvert = async () => {
    const ok = await confirm({
      title: `Register ${lead.name} as a member?`,
      body: "A member profile is created from this lead. You can add a plan and take payment next.",
      confirmLabel: "Register member",
    });
    if (!ok) return;
    convert.mutate(lead._id, {
      onSuccess: (data) => {
        toast.success(data.linkedExisting ? `Linked to existing member ${data.member.name}` : `${data.member.name} registered`, {
          description: `Member code ${data.member.memberCode}`,
        });
        navigate(`/admin/members/${data.memberId}?action=renew`);
      },
      onError: (e) => toast.error("Couldn't convert the lead", { description: e.message }),
    });
  };

  const onLost = async () => {
    const ok = await confirm({ title: `Mark ${lead.name} as lost?`, body: "They'll move out of the open list. You can reopen them later.", confirmLabel: "Mark as lost", tone: "danger" });
    if (ok) move("lost", { nextFollowUpAt: null });
  };

  const setSpam = (spam) =>
    update.mutate(
      { id: lead._id, patch: { spam } },
      {
        onSuccess: () => toast.success(spam ? `${lead.name} moved to likely spam` : `${lead.name} moved back to leads`),
        onError: (e) => toast.error("Couldn't update the lead", { description: e.message }),
      }
    );

  const onResort = () =>
    retriage.mutate(lead._id, {
      onSuccess: () => toast.success("Enquiry sorted again"),
      onError: (e) => toast.error("Couldn't sort this enquiry", { description: e.message }),
    });

  const isSpam = lead.triage?.spam === true;
  const planSuggested = lead.triage?.filled?.includes("interestPlanId");

  return (
    <Card className="flex w-full flex-col">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-body-lg font-semibold">{lead.name}</p>
          <p className="truncate text-body-sm text-ink-3">
            {LEAD_SOURCE_LABEL[lead.source]}, added {formatRelativeTime(lead.createdAt)}
          </p>
        </div>
        <StatusBadge kind="lead" status={lead.status} size="sm" />
      </div>

      <TriageChips lead={lead} />

      <div className="mt-3 flex flex-wrap gap-1.5">
        {lead.interestPlanId && (
          <Badge size="sm" icon={planSuggested ? Sparkles : undefined}>
            {planSuggested && <span className="sr-only">Suggested from the message: </span>}
            {lead.interestPlanId.name}
          </Badge>
        )}
        {open && !isSpam && due != null && (
          <Badge size="sm" tone={due < 0 ? "bad" : due === 0 ? "warn" : "neutral"} icon={CalendarClock}>
            {due < 0 ? `Follow-up overdue (${formatShortDate(lead.nextFollowUpAt)})` : due === 0 ? "Follow up today" : `Follow up ${formatRelativeDay(lead.nextFollowUpAt)}`}
          </Badge>
        )}
      </div>

      {(lastNote || lead.message) && (
        <p className="mt-3 line-clamp-2 text-sm text-ink-2">
          <StickyNote className="mr-1.5 inline size-3.5 text-ink-3" aria-hidden />
          {lastNote ? lastNote.text : lead.message}
        </p>
      )}

      <div className="mt-auto flex items-center gap-1 pt-4">
        {tel && (
          <a href={tel} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-surface-2 px-3 text-sm font-semibold hover:bg-surface-3" aria-label={`Call ${lead.name}`}>
            <Phone className="size-4" aria-hidden />
            Call
          </a>
        )}
        {wa && (
          <a href={wa} target="_blank" rel="noreferrer" className="grid size-9 place-items-center rounded-[10px] bg-surface-2 hover:bg-surface-3" aria-label={`WhatsApp ${lead.name}`}>
            <MessageCircle className="size-4" aria-hidden />
          </a>
        )}
        {open && !isSpam && (
          <Button size="sm" variant="ghost" icon={PhoneCall} onClick={() => onLog(lead)}>
            Log call
          </Button>
        )}
        <div className="flex-1" />
        {isSpam ? (
          <Button size="sm" variant="quiet" icon={ShieldCheck} onClick={() => setSpam(false)} loading={update.isPending}>
            Not spam
          </Button>
        ) : (
          open && (
            <Button size="sm" variant="quiet" icon={UserCheck} onClick={onConvert} loading={convert.isPending}>
              Join
            </Button>
          )
        )}
        <Menu
          label={`Actions for ${lead.name}`}
          trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${lead.name}`} size="sm" />}
          items={[
            lead.status !== "contacted" && open && { label: "Mark as contacted", icon: PhoneCall, onSelect: () => move("contacted") },
            lead.status !== "trial" && open && { label: "Mark as on trial", icon: Flame, onSelect: () => move("trial") },
            !open && { label: "Reopen lead", icon: Inbox, onSelect: () => move("contacted", { nextFollowUpAt: followUpDate("tomorrow") }) },
            { label: "Edit lead", icon: Pencil, onSelect: () => onEdit(lead) },
            triageEnabled && lead.message && { label: "Sort again", icon: RotateCw, onSelect: onResort, disabled: retriage.isPending },
            { type: "separator" },
            isSpam
              ? { label: "Not spam", icon: ShieldCheck, onSelect: () => setSpam(false) }
              : { label: "Move to likely spam", icon: ShieldAlert, onSelect: () => setSpam(true) },
            open && !isSpam && { label: "Mark as lost", icon: Ban, tone: "danger", onSelect: onLost },
          ]}
        />
      </div>
    </Card>
  );
}

export default function LeadsPage() {
  const [filters, setFilters] = useUrlState(DEFAULTS);
  const [search, setSearch] = useState(filters.q);
  const debounced = useDebouncedValue(search.trim(), 300);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [logging, setLogging] = useState(null);

  useEffect(() => {
    if (debounced !== filters.q) setFilters({ q: debounced });
  }, [debounced, filters.q, setFilters]);

  const reviewingSpam = filters.spam === "only";
  const query = useLeads({
    status: reviewingSpam ? "open" : filters.status,
    due: reviewingSpam ? undefined : filters.due || undefined,
    q: filters.q || undefined,
    spam: reviewingSpam ? "only" : undefined,
    limit: 60,
  });
  const counts = query.data?.counts || {};
  const leads = query.data?.leads || [];
  const triageEnabled = Boolean(query.data?.triageEnabled);

  return (
    <>
      <PageHeader
        title="Leads"
        description="People who asked about joining. Website enquiries arrive here automatically."
        actions={
          <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
            Add lead
          </Button>
        }
      />
      {reviewingSpam ? (
        <InlineAlert
          tone="warning"
          title="Likely spam"
          className="mb-4"
          action={
            <Button size="sm" variant="secondary" onClick={() => setFilters({ spam: "" })}>
              Back to leads
            </Button>
          }
        >
          These enquiries were hidden automatically because they look like marketing or junk. Open any that look real and choose Not spam.
        </InlineAlert>
      ) : (
        <Tabs
          label="Lead stages"
          value={filters.status}
          onChange={(status) => setFilters({ status })}
          className="mb-4"
          tabs={[
            { value: "open", label: "Open", count: counts.open },
            { value: "new", label: "New", count: counts.new },
            { value: "contacted", label: "Contacted", count: counts.contacted },
            { value: "trial", label: "On trial", count: counts.trial },
            { value: "won", label: "Joined", count: counts.won },
            { value: "lost", label: "Lost", count: counts.lost },
          ]}
        />
      )}
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or email" label="Search leads" className="md:max-w-sm md:flex-1" />
        {!reviewingSpam && (
          <FilterChips
            label="Follow-up"
            value={filters.due}
            onChange={(due) => setFilters({ due })}
            options={[
              { value: "", label: "Any follow-up" },
              { value: "today", label: "Due today" },
              { value: "overdue", label: "Overdue" },
            ]}
          />
        )}
        {!reviewingSpam && counts.spam > 0 && (
          <button
            type="button"
            onClick={() => setFilters({ spam: "only" })}
            className="inline-flex h-9 items-center gap-1.5 self-start rounded-full px-2 text-body-sm font-semibold text-ink-3 hover:text-ink md:ml-auto md:self-auto"
          >
            <ShieldAlert className="size-4" aria-hidden />
            {counts.spam} hidden as likely spam
          </button>
        )}
      </div>

      {query.isPending ? (
        <Card>
          <SkeletonList rows={4} />
        </Card>
      ) : query.isError && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : leads.length === 0 ? (
        <Card>
          {reviewingSpam ? (
            <EmptyState
              icon={ShieldCheck}
              title="Nothing hidden as spam"
              body="Enquiries that look like marketing or junk will collect here instead of cluttering your leads."
              action={
                <Button variant="secondary" onClick={() => setFilters({ spam: "" })}>
                  Back to leads
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={Inbox}
              title={filters.due ? "No follow-ups due" : "No leads here"}
              body={filters.due ? "You're up to date with calls." : "Add walk-in enquiries here. Website contact-form messages are added automatically."}
              action={
                <Button variant="secondary" icon={Plus} onClick={() => setCreating(true)}>
                  Add lead
                </Button>
              }
            />
          )}
        </Card>
      ) : (
        <ul className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
          {leads.map((lead) => (
            <li key={lead._id} className="flex">
              <LeadCard lead={lead} onEdit={setEditing} onLog={setLogging} triageEnabled={triageEnabled} />
            </li>
          ))}
        </ul>
      )}

      <LeadFormDialog open={creating || Boolean(editing)} lead={editing} onClose={() => (setCreating(false), setEditing(null))} />
      <LogCallDialog lead={logging} onClose={() => setLogging(null)} />
    </>
  );
}
