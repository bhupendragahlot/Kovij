import { useState } from "react";
import { Archive, ArrowDown, ArrowUp, CopyPlus, Ellipsis, MessageSquarePlus, Plus, Trash2, X } from "lucide-react";
import { ExercisePicker } from "./ExercisePicker";
import { EQUIPMENT_LABEL, MUSCLE_LABEL, REST_OPTIONS, formatRest } from "./labels";
import { draftExercise, duplicateDay, emptyDay, move } from "./planDraft";
import { Badge, Button, Card, Field, IconButton, Input, Menu, Select } from "../../shared/ui";

const MAX_DAYS = 7;
const MAX_EXERCISES = 30;

function ExerciseRow({ exercise: e, index, count, dayIndex, errors, onChange, onMove, onRemove }) {
  const [showNote, setShowNote] = useState(Boolean(e.notes));
  const err = (field) => errors[`days.${dayIndex}.exercises.${index}.${field}`];
  const set = (patch) => onChange({ ...e, ...patch });
  return (
    <li className="rounded-tile border border-line p-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 grid size-6 shrink-0 place-items-center rounded-full bg-surface-2 text-xs font-bold text-ink-2" aria-hidden>
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-6 text-ink">{e.name}</p>
          <p className="text-[13px] text-ink-3">
            {[MUSCLE_LABEL[e.primaryMuscle], EQUIPMENT_LABEL[e.equipment]].filter(Boolean).join(", ")}
            {e.archived && (
              <Badge size="sm" icon={Archive} className="ml-2 align-middle">
                Archived
              </Badge>
            )}
          </p>
          {err("exerciseId") && <p className="mt-1 text-[13px] font-medium text-bad">{err("exerciseId")}</p>}
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Field label="Sets" error={err("sets")}>
          <Input type="number" inputMode="numeric" min={1} max={20} value={e.sets} onChange={(ev) => set({ sets: ev.target.value })} />
        </Field>
        <Field label="Reps" error={err("reps")}>
          <Input value={e.reps} onChange={(ev) => set({ reps: ev.target.value })} maxLength={20} placeholder="8-12" />
        </Field>
        <Field label="Weight" error={err("weightKg")}>
          <Input type="number" inputMode="decimal" min={0} step="0.5" value={e.weightKg} onChange={(ev) => set({ weightKg: ev.target.value })} suffix="kg" placeholder="—" />
        </Field>
        <Field label="Rest" error={err("restSec")}>
          <Select value={e.restSec} onChange={(ev) => set({ restSec: Number(ev.target.value) })}>
            {[...new Set([...REST_OPTIONS, Number(e.restSec) || 0])]
              .sort((a, b) => a - b)
              .map((s) => (
                <option key={s} value={s}>
                  {formatRest(s)}
                </option>
              ))}
          </Select>
        </Field>
      </div>
      {showNote && (
        <Field label="Note for the member" optional className="mt-2" error={err("notes")}>
          <Input value={e.notes} onChange={(ev) => set({ notes: ev.target.value })} maxLength={300} placeholder="e.g. Slow on the way down" autoFocus={!e.notes} />
        </Field>
      )}
      <div className="mt-2 flex items-center justify-between gap-2">
        {showNote ? (
          <span />
        ) : (
          <Button variant="ghost" icon={MessageSquarePlus} className="-ml-2" onClick={() => setShowNote(true)}>
            Add note
          </Button>
        )}
        <div className="flex items-center">
          <IconButton icon={ArrowUp} label={`Move ${e.name} up`} disabled={index === 0} onClick={() => onMove(-1)} />
          <IconButton icon={ArrowDown} label={`Move ${e.name} down`} disabled={index === count - 1} onClick={() => onMove(1)} />
          <IconButton icon={X} label={`Remove ${e.name}`} onClick={onRemove} />
        </div>
      </div>
    </li>
  );
}

/**
 * Days of a plan: rename, reorder, duplicate or remove days; add, reorder and remove
 * exercises; set sets, reps, weight and rest. Controlled: `days` in, `onChange(days)` out.
 */
export function PlanDaysEditor({ days, onChange, errors = {} }) {
  const [pickFor, setPickFor] = useState(null);

  const setDay = (i, day) => onChange(days.map((d, k) => (k === i ? day : d)));
  const addExercises = (i, picked) => {
    const day = days[i];
    const room = MAX_EXERCISES - day.exercises.length;
    setDay(i, { ...day, exercises: [...day.exercises, ...picked.slice(0, room).map(draftExercise)] });
  };

  return (
    <div className="flex flex-col gap-4">
      {errors.days && <p className="text-sm font-medium text-bad">{errors.days}</p>}
      {days.map((day, i) => (
        <Card key={day.key} as="section" aria-label={day.name || `Day ${i + 1}`}>
          <div className="flex items-start gap-2">
            <Field label={`Day ${i + 1} name`} error={errors[`days.${i}.name`]} className="min-w-0 flex-1">
              <Input value={day.name} onChange={(e) => setDay(i, { ...day, name: e.target.value })} maxLength={60} placeholder="e.g. Day 1 – Push" />
            </Field>
            <div className="pt-7">
              <Menu
                label={`Actions for ${day.name || `day ${i + 1}`}`}
                trigger={(props) => <IconButton {...props} icon={Ellipsis} label={`Actions for ${day.name || `day ${i + 1}`}`} variant="secondary" />}
                items={[
                  { label: "Move day up", icon: ArrowUp, disabled: i === 0, onSelect: () => onChange(move(days, i, -1)) },
                  { label: "Move day down", icon: ArrowDown, disabled: i === days.length - 1, onSelect: () => onChange(move(days, i, 1)) },
                  { label: "Duplicate day", icon: CopyPlus, disabled: days.length >= MAX_DAYS, onSelect: () => onChange([...days.slice(0, i + 1), duplicateDay(day), ...days.slice(i + 1)]) },
                  { type: "separator" },
                  { label: "Remove day", icon: Trash2, tone: "danger", disabled: days.length === 1, onSelect: () => onChange(days.filter((_, k) => k !== i)) },
                ]}
              />
            </div>
          </div>

          {day.exercises.length ? (
            <ol className="mt-4 flex flex-col gap-2">
              {day.exercises.map((e, j) => (
                <ExerciseRow
                  key={e.key}
                  exercise={e}
                  index={j}
                  count={day.exercises.length}
                  dayIndex={i}
                  errors={errors}
                  onChange={(next) => setDay(i, { ...day, exercises: day.exercises.map((x, k) => (k === j ? next : x)) })}
                  onMove={(step) => setDay(i, { ...day, exercises: move(day.exercises, j, step) })}
                  onRemove={() => setDay(i, { ...day, exercises: day.exercises.filter((_, k) => k !== j) })}
                />
              ))}
            </ol>
          ) : (
            <p className="mt-4 rounded-tile bg-surface-2 p-4 text-center text-sm text-ink-3">No exercises on this day yet.</p>
          )}
          <Button className="mt-3" variant="secondary" icon={Plus} onClick={() => setPickFor(i)} disabled={day.exercises.length >= MAX_EXERCISES} block>
            Add exercises
          </Button>
        </Card>
      ))}
      {days.length < MAX_DAYS && (
        <Button variant="quiet" icon={Plus} onClick={() => onChange([...days, emptyDay(days.length)])}>
          Add day {days.length + 1}
        </Button>
      )}
      <ExercisePicker
        open={pickFor != null}
        onClose={() => setPickFor(null)}
        title={pickFor != null ? `Add exercises to ${days[pickFor]?.name || `day ${pickFor + 1}`}` : "Add exercises"}
        onPick={(picked) => addExercises(pickFor, picked)}
      />
    </div>
  );
}
