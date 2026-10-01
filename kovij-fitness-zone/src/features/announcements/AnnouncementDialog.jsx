import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { fetchAudienceSize, usePublishAnnouncement, useSaveAnnouncement, useAudienceSize } from "./api";
import { CATEGORY, endOfGymDayIso, fromGymInput, toGymInput } from "./labels";
import { AUDIENCE_LABEL } from "../notifications/labels";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import { Button, Dialog, Field, FormError, InlineAlert, Input, SegmentedControl, Select, Switch, Textarea, useConfirm, useToast } from "../../shared/ui";
import { formatDateTime, formatNumber, gymDayKey, pluralize } from "../../shared/lib/format";

const TITLE_MAX = 120;
const BODY_MAX = 2000;

function initialForm(a) {
  const scheduled = a && ["draft", "scheduled"].includes(a.status) && a.publishAt && new Date(a.publishAt) > new Date();
  return {
    title: a?.title || "",
    body: a?.body || "",
    category: a?.category || "notice",
    audience: a?.audience || "all",
    imageUrl: a?.imageUrl || "",
    pinned: Boolean(a?.pinned),
    sendEmail: Boolean(a?.sendEmail),
    when: scheduled ? "schedule" : "now",
    publishAt: scheduled ? toGymInput(a.publishAt) : "",
    expiresOn: a?.expiresAt ? gymDayKey(a.expiresAt) : "",
  };
}

/**
 * Create or edit an announcement. New ones and drafts can be saved as a draft, published now,
 * or scheduled. Once sent, who it went to and whether it was emailed can't change.
 */
export function AnnouncementDialog({ open, onClose, announcement }) {
  const editing = Boolean(announcement);
  const sent = editing && announcement.delivery?.state && announcement.delivery.state !== "none";
  const isLive = editing && announcement.status === "published";
  const canPublish = !editing || ["draft", "unpublished"].includes(announcement.status);
  const [form, setForm] = useState(() => initialForm(announcement));
  const [clientErrors, setClientErrors] = useState({});
  const save = useSaveAnnouncement();
  const publish = usePublishAnnouncement();
  const idempotency = useIdempotencyKey();
  const queryClient = useQueryClient();
  const confirm = useConfirm();
  const toast = useToast();
  const online = useOnlineStatus();
  const audience = useAudienceSize(form.audience, { enabled: open });

  useEffect(() => {
    if (!open) return;
    setForm(initialForm(announcement));
    setClientErrors({});
    save.reset();
    publish.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, announcement?._id]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));
  const serverErrors = save.error?.fields || publish.error?.fields || {};
  const errors = { ...serverErrors, ...clientErrors };
  const busy = save.isPending || publish.isPending;
  const schedule = form.when === "schedule";

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = "Add a title";
    if (!form.body.trim()) e.body = "Write the announcement";
    if (schedule && !form.publishAt) e.publishAt = "Pick when it goes out";
    else if (schedule && new Date(fromGymInput(form.publishAt)) <= new Date()) e.publishAt = "Pick a time in the future";
    if (form.expiresOn && form.expiresOn < gymDayKey()) e.expiresAt = "Pick today or a later day";
    setClientErrors(e);
    return Object.keys(e).length === 0;
  }

  function payload() {
    const p = {
      title: form.title.trim(),
      body: form.body.trim(),
      category: form.category,
      imageUrl: form.imageUrl.trim(),
      pinned: form.pinned,
      expiresAt: form.expiresOn ? endOfGymDayIso(form.expiresOn) : null,
    };
    // Who it goes to and when are fixed once it has been sent or is live.
    if (!sent) Object.assign(p, { audience: form.audience, sendEmail: form.sendEmail });
    if (!isLive) p.publishAt = schedule ? fromGymInput(form.publishAt) : null;
    return p;
  }

  const saveOnly = async () => {
    if (!validate()) return;
    try {
      const res = await save.mutateAsync({ id: announcement?._id, payload: payload() });
      toast.success(editing ? "Announcement saved" : "Draft saved", {
        description: res.announcement.status === "published" && !isLive ? "It went out because its time had come." : undefined,
      });
      onClose();
    } catch {
      /* shown in the form */
    }
  };

  const saveAndPublish = async () => {
    if (!validate()) return;
    const size = await fetchAudienceSize(queryClient, form.audience).catch(() => null);
    const reach = size ? pluralize(size.reachable, "member") : "the members in this audience";
    const channels = ["in the app", form.sendEmail && "by email", "as a phone notification if they turned those on"].filter(Boolean).join(", ");
    const ok = await confirm({
      title: schedule ? `Schedule for ${reach}?` : `Publish to ${reach}?`,
      body: `${schedule ? `On ${formatDateTime(fromGymInput(form.publishAt))} they'll` : "They'll"} get it ${channels}. A sent announcement can be taken down but not unsent.`,
      confirmLabel: schedule ? "Schedule" : "Publish",
    });
    if (!ok) return;
    try {
      const saved = await save.mutateAsync({ id: announcement?._id, payload: payload() });
      const id = saved.announcement._id;
      const res = await publish.mutateAsync({ id, idempotencyKey: idempotency.keyFor({ id, action: "publish" }) });
      idempotency.reset();
      const a = res.announcement;
      toast.success(a.status === "scheduled" ? "Announcement scheduled" : "Announcement published", {
        description: a.status === "scheduled" ? `Goes out ${formatDateTime(a.publishAt)}.` : "Members are being notified now.",
      });
      onClose();
    } catch {
      /* shown in the form */
    }
  };

  const reach = audience.data;
  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      title={editing ? "Edit announcement" : "New announcement"}
      description={editing ? undefined : "Members see it in the app. You can also email it."}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          {canPublish ? (
            <>
              <Button variant="secondary" onClick={saveOnly} loading={save.isPending && !publish.isPending} disabled={!online || busy}>
                {editing && announcement.status !== "draft" ? "Save" : "Save draft"}
              </Button>
              <Button variant="primary" onClick={saveAndPublish} loading={publish.isPending} disabled={!online || busy}>
                {schedule ? "Schedule" : "Publish"}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={saveOnly} loading={save.isPending} disabled={!online || busy}>
              Save changes
            </Button>
          )}
        </>
      }
    >
      <FormError error={save.error || publish.error} />
      {!online && (
        <InlineAlert tone="offline" className="mb-4">
          You're offline. You can keep writing; saving works when the connection is back.
        </InlineAlert>
      )}
      <form onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 gap-4" noValidate>
        <Field label="Title" error={errors.title} required hint={`${form.title.length}/${TITLE_MAX}`}>
          <Input value={form.title} onChange={(e) => set({ title: e.target.value.replace(/[\r\n]/g, " ") })} maxLength={TITLE_MAX} placeholder="e.g. Gym closed on Diwali" />
        </Field>
        <Field label="Message" error={errors.body} required hint={`${form.body.length}/${BODY_MAX}`}>
          <Textarea value={form.body} onChange={(e) => set({ body: e.target.value })} rows={5} maxLength={BODY_MAX} placeholder="What members need to know, in a few lines." />
        </Field>
        <Field label="Type" error={errors.category}>
          <SegmentedControl
            label="Type"
            block
            size="sm"
            value={form.category}
            onChange={(category) => set({ category })}
            options={Object.entries(CATEGORY).map(([value, c]) => ({ value, label: c.label }))}
          />
        </Field>
        <Field
          label="Who gets it"
          error={errors.audience}
          hint={
            sent
              ? "Already sent, so this can't change. Create a new announcement to reach other members."
              : reach
                ? `${pluralize(reach.count, "member")}${reach.count !== reach.reachable ? `, ${formatNumber(reach.count - reach.reachable)} turned announcements off` : ""}.`
                : audience.isError
                  ? "Couldn't count members right now."
                  : "Counting members…"
          }
        >
          <Select value={form.audience} onChange={(e) => set({ audience: e.target.value })} disabled={sent}>
            {Object.entries(AUDIENCE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </Field>

        {!isLive && (
          <Field label="When" error={errors.publishAt} hint={schedule ? "Gym time (India). It goes out within 5 minutes of this time." : undefined}>
            <div className="flex flex-col gap-3">
              <SegmentedControl
                label="When"
                size="sm"
                value={form.when}
                onChange={(when) => set({ when })}
                options={[
                  { value: "now", label: "As soon as I publish" },
                  { value: "schedule", label: "Schedule" },
                ]}
              />
              {schedule && (
                <Input
                  type="datetime-local"
                  aria-label="Date and time it goes out (gym time)"
                  value={form.publishAt}
                  min={toGymInput(new Date())}
                  onChange={(e) => set({ publishAt: e.target.value })}
                />
              )}
            </div>
          </Field>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Show until" optional error={errors.expiresAt} hint="Leave empty to keep it up until you take it down.">
            <Input type="date" value={form.expiresOn} min={gymDayKey()} onChange={(e) => set({ expiresOn: e.target.value })} />
          </Field>
          <Field label="Image link" optional error={errors.imageUrl} hint="An https link to a poster or photo.">
            <Input type="url" inputMode="url" value={form.imageUrl} onChange={(e) => set({ imageUrl: e.target.value })} placeholder="https://" />
          </Field>
        </div>

        <div className="flex flex-col gap-4 rounded-tile bg-surface-2 p-4">
          <Switch checked={form.pinned} onChange={(pinned) => set({ pinned })} label="Pin to the top" description="Pinned announcements stay above newer ones in the app." />
          <Switch
            checked={form.sendEmail}
            onChange={(sendEmail) => set({ sendEmail })}
            disabled={sent}
            label="Also send by email"
            description={sent ? "Already sent, so this can't change." : "Members without an email, or who turned announcement emails off, won't get one."}
          />
        </div>
      </form>
    </Dialog>
  );
}
