import { useState } from "react";
import { Dumbbell, Ellipsis, HeartPulse, Lock, MessageSquareWarning, NotebookPen, Pencil, Pin, PinOff, Plus, StickyNote, Trash2, Wallet } from "lucide-react";
import { useAddNote, useDeleteNote, useNotes, useUpdateNote } from "./api";
import { usePermission } from "../auth/permissions";
import { useIdempotencyKey } from "../../shared/hooks/useIdempotencyKey";
import { useOnlineStatus } from "../../shared/hooks/useOnlineStatus";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Field,
  FilterChips,
  FormError,
  IconButton,
  InlineAlert,
  Menu,
  Pagination,
  Select,
  SkeletonList,
  Switch,
  Textarea,
  useConfirm,
  useToast,
} from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatDateTime, formatRelativeTime } from "../../shared/lib/format";

/**
 * OWNER: diet, progress & notes module. Member profile tab: "Notes".
 * A staff-only timeline: pinned notes first, then newest. Authors edit their own notes; anyone
 * with notes access can pin; managers can delete any note. Members never see these.
 */

const CATEGORY = {
  general: { label: "General", icon: StickyNote, tone: "neutral" },
  health: { label: "Health", icon: HeartPulse, tone: "info" },
  training: { label: "Training", icon: Dumbbell, tone: "brand" },
  billing: { label: "Billing", icon: Wallet, tone: "warn" },
  complaint: { label: "Complaint", icon: MessageSquareWarning, tone: "bad" },
};
const ROLE_LABEL = { admin: "Owner", manager: "Manager", staff: "Front desk", trainer: "Trainer" };
const LIMIT = 30;

function CategorySelect({ value, onChange, canHealth, id }) {
  return (
    <Select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(CATEGORY)
        .filter(([k]) => canHealth || k !== "health")
        .map(([k, meta]) => (
          <option key={k} value={k}>
            {meta.label}
          </option>
        ))}
    </Select>
  );
}

function Composer({ memberId, canHealth }) {
  const add = useAddNote(memberId);
  const idempotency = useIdempotencyKey();
  const online = useOnlineStatus();
  const toast = useToast();
  const [text, setText] = useState("");
  const [category, setCategory] = useState("general");
  const [pinned, setPinned] = useState(false);
  const errors = add.error?.fields || {};

  const submit = (e) => {
    e.preventDefault();
    const payload = { text: text.trim(), category, pinned };
    add.mutate(
      { payload, idempotencyKey: idempotency.keyFor(payload) },
      {
        onSuccess: () => {
          idempotency.reset();
          setText("");
          setPinned(false);
          toast.success(pinned ? "Note added and pinned" : "Note added");
        },
      }
    );
  };

  return (
    <Card>
      <form onSubmit={submit} noValidate className="flex flex-col gap-3">
        <FormError error={add.error} />
        <Field label="New note" error={errors.text}>
          <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="e.g. Prefers the evening batch. Mentioned lower back pain on deadlifts." />
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[12rem_minmax(0,1fr)_auto] sm:items-end">
          <Field label="Category" error={errors.category}>
            <CategorySelect value={category} onChange={setCategory} canHealth={canHealth} />
          </Field>
          <div className="sm:pb-2">
            <Switch label="Pin to top" description="For things every shift should see." checked={pinned} onChange={setPinned} />
          </div>
          <Button type="submit" variant="primary" icon={Plus} loading={add.isPending} disabled={!online || !text.trim()}>
            Add note
          </Button>
        </div>
        {!online && <p className="text-[13px] text-warn">You&apos;re offline. Reconnect to add notes.</p>}
      </form>
    </Card>
  );
}

function NoteItem({ note, memberId, canHealth }) {
  const update = useUpdateNote(memberId);
  const remove = useDeleteNote(memberId);
  const online = useOnlineStatus();
  const confirm = useConfirm();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [category, setCategory] = useState(note.category);
  const meta = CATEGORY[note.category] || CATEGORY.general;
  const fail = (what) => (e) => toast.error(`Couldn't ${what}`, { description: e.message });

  const startEdit = () => {
    update.reset();
    setText(note.text);
    setCategory(note.category);
    setEditing(true);
  };
  const saveEdit = (e) => {
    e.preventDefault();
    update.mutate(
      { id: note._id, patch: { text: text.trim(), category } },
      {
        onSuccess: () => {
          setEditing(false);
          toast.success("Note saved");
        },
      }
    );
  };
  const togglePin = () =>
    update.mutate({ id: note._id, patch: { pinned: !note.pinned } }, { onSuccess: () => toast.success(note.pinned ? "Note unpinned" : "Note pinned"), onError: fail(note.pinned ? "unpin the note" : "pin the note") });
  const onDelete = async () => {
    const ok = await confirm({ title: "Delete this note?", body: "It is removed for all staff. This can't be undone.", confirmLabel: "Delete note", tone: "danger" });
    if (ok) remove.mutate(note._id, { onSuccess: () => toast.success("Note deleted"), onError: fail("delete the note") });
  };

  return (
    <li>
      <Card padding="sm" className={cn(note.pinned && "border-line-strong")}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge size="sm" tone={meta.tone} icon={meta.icon}>
                {meta.label}
              </Badge>
              {note.pinned && (
                <Badge size="sm" icon={Pin}>
                  Pinned
                </Badge>
              )}
            </div>
            {editing ? (
              <form onSubmit={saveEdit} noValidate className="mt-3 flex flex-col gap-3">
                <FormError error={update.error} />
                <Field label="Note" error={update.error?.fields?.text}>
                  <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} autoFocus />
                </Field>
                <Field label="Category" error={update.error?.fields?.category} className="sm:max-w-48">
                  <CategorySelect value={category} onChange={setCategory} canHealth={canHealth} />
                </Field>
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="primary" size="sm" loading={update.isPending} disabled={!online || !text.trim()}>
                    Save note
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setEditing(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink">{note.text}</p>
            )}
            <p className="mt-2 text-xs text-ink-3">
              {note.author.name}
              {ROLE_LABEL[note.author.role] ? ` (${ROLE_LABEL[note.author.role]})` : ""},{" "}
              <time dateTime={note.createdAt} title={formatDateTime(note.createdAt)}>
                {formatRelativeTime(note.createdAt)}
              </time>
              {note.editedAt && <span title={`Edited ${formatDateTime(note.editedAt)}`}>, edited</span>}
            </p>
          </div>
          <IconButton icon={note.pinned ? PinOff : Pin} label={note.pinned ? "Unpin note" : "Pin note"} onClick={togglePin} disabled={!online || update.isPending} />
          {(note.canEdit || note.canDelete) && (
            <Menu
              label="Note actions"
              trigger={(props) => <IconButton {...props} icon={Ellipsis} label="Note actions" />}
              items={[
                note.canEdit && { label: "Edit note", icon: Pencil, onSelect: startEdit, disabled: !online },
                note.canDelete && { label: "Delete note", icon: Trash2, tone: "danger", onSelect: onDelete, disabled: !online },
              ]}
            />
          )}
        </div>
      </Card>
    </li>
  );
}

export default function MemberNotesTab({ member }) {
  const canHealth = usePermission("members.health.view");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);
  const query = useNotes(member._id, { category: category || undefined, page, limit: LIMIT });
  const counts = query.data?.counts || {};
  const notes = query.data?.notes || [];

  return (
    <div className="flex flex-col gap-4">
      <InlineAlert tone="info">
        <span className="inline-flex items-center gap-1.5">
          <Lock className="size-4" aria-hidden />
          Only staff can see these notes. {member.name.split(" ")[0]} never does.
        </span>
      </InlineAlert>
      <Composer memberId={member._id} canHealth={canHealth} />
      <FilterChips
        label="Note category"
        value={category}
        onChange={(c) => (setCategory(c), setPage(1))}
        options={[
          { value: "", label: "All", count: counts.all },
          ...Object.entries(CATEGORY)
            .filter(([k]) => canHealth || k !== "health")
            .map(([value, meta]) => ({ value, label: meta.label, count: counts[value] })),
        ]}
      />
      {query.isPending ? (
        <Card>
          <SkeletonList rows={3} />
        </Card>
      ) : query.isError && !query.data ? (
        <Card>
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        </Card>
      ) : notes.length === 0 ? (
        <Card>
          <EmptyState
            compact
            icon={NotebookPen}
            title={category ? `No ${CATEGORY[category].label.toLowerCase()} notes` : "No notes yet"}
            body={category ? "Try another category." : "Write down anything the next shift should know: injuries, preferences, promises made at the desk."}
          />
        </Card>
      ) : (
        <>
          <ol className={cn("flex flex-col gap-3 transition-opacity", query.isFetching && query.isPlaceholderData && "opacity-60")}>
            {notes.map((n) => (
              <NoteItem key={n._id} note={n} memberId={member._id} canHealth={canHealth} />
            ))}
          </ol>
          <Pagination page={page} limit={LIMIT} total={query.data.total} onPage={setPage} className="rounded-card bg-surface" />
        </>
      )}
    </div>
  );
}
