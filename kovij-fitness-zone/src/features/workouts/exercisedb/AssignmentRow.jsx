import { CheckCircle2, CircleDashed, Ellipsis, Info, Pencil, Trash2 } from "lucide-react";
import { useExerciseDbExercise } from "./api";
import { ExerciseDbDialog } from "../../exercisedb/ExerciseDbDialog";
import { STATE, dayLabel, prescription } from "../../exercisedb/format";
import { Badge, Button, IconButton, Menu } from "../../../shared/ui";
import { formatDateTime } from "../../../shared/lib/format";

/** Actions a manager or the member's trainer can take on one scheduled exercise. */
export function AssignmentMenu({ a, todayKey, actions, onEdit, onOpen }) {
  const due = a.dayKey <= todayKey;
  const items = [
    { label: "How to do it", icon: Info, onSelect: () => onOpen(a) },
    a.status !== "cancelled" &&
      due && {
        label: a.status === "completed" ? "Mark not done" : "Mark done",
        icon: a.status === "completed" ? CircleDashed : CheckCircle2,
        onSelect: () => actions.toggleDone(a),
      },
    a.status === "assigned" && { label: "Edit", icon: Pencil, onSelect: () => onEdit(a) },
    a.status === "assigned" && { type: "separator" },
    a.status === "assigned" && { label: "Remove", icon: Trash2, tone: "danger", onSelect: () => actions.remove(a) },
  ].filter(Boolean);
  return (
    <Menu
      label={`Actions for ${a.exercise.name}`}
      trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${a.exercise.name}`} size="sm" />}
      items={items}
    />
  );
}

export function StateBadge({ a }) {
  const s = STATE[a.state] || STATE.upcoming;
  return (
    <Badge size="sm" tone={s.tone} icon={a.state === "done" ? CheckCircle2 : undefined}>
      {s.label}
    </Badge>
  );
}

/** One scheduled exercise in a staff list. */
export function AssignmentRow({ a, todayKey, canManage, actions, onEdit, onOpen, showDay = false }) {
  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <button type="button" onClick={() => onOpen(a)} className="min-w-0 flex-1 text-left">
        <span className="block font-semibold text-ink hover:underline">{a.exercise.name}</span>
        <span className="block text-[13px] text-ink-3">
          {[showDay && dayLabel(a.dayKey, todayKey), prescription(a)].filter(Boolean).join(" · ") || "No sets or time given"}
        </span>
        {a.notes && <span className="block text-[13px] text-ink-2">Note: {a.notes}</span>}
        {a.memberNote && <span className="block text-[13px] text-ink-2">Member: “{a.memberNote}”</span>}
        {a.completedAt && (
          <span className="block text-xs text-ink-3">
            Done {formatDateTime(a.completedAt)}
            {a.completedBy === "staff" ? " (marked by staff)" : ""}
          </span>
        )}
      </button>
      <StateBadge a={a} />
      {canManage && <AssignmentMenu a={a} todayKey={todayKey} actions={actions} onEdit={onEdit} onOpen={onOpen} />}
    </li>
  );
}

/** The trainer's prescription above ExerciseDB's own details. */
export function AssignmentDetailDialog({ a, onClose, todayKey }) {
  const query = useExerciseDbExercise(a?.exercise.exerciseDbId);
  return (
    <ExerciseDbDialog
      open={Boolean(a)}
      onClose={onClose}
      exercise={a?.exercise}
      query={query}
      footer={
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      }
    >
      {a && (
        <div className="rounded-tile bg-surface-2 p-3 text-sm">
          <p className="font-semibold text-ink">
            {dayLabel(a.dayKey, todayKey, { long: true })}: {prescription(a) || "No sets or time given"}
          </p>
          {a.notes && <p className="mt-1 text-ink-2">Note: {a.notes}</p>}
          {a.memberNote && <p className="mt-1 text-ink-2">Member: “{a.memberNote}”</p>}
        </div>
      )}
    </ExerciseDbDialog>
  );
}
