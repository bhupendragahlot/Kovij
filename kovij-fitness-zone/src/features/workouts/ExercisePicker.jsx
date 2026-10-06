import { useEffect, useState } from "react";
import { Check, Plus } from "lucide-react";
import { useExercises } from "./api";
import { ExerciseFormDialog } from "./ExerciseFormDialog";
import { EQUIPMENT_LABEL, MUSCLE_LABEL } from "./labels";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { Button, Dialog, EmptyState, ErrorState, FilterChips, SearchInput, SkeletonList } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";

const MUSCLES = [{ value: "all", label: "All" }, ...Object.entries(MUSCLE_LABEL).map(([value, label]) => ({ value, label }))];

/**
 * Choose one or more exercises from the library. `onPick(exercises)` receives the chosen
 * library entries in the order they were tapped.
 */
export function ExercisePicker({ open, onClose, onPick, title = "Add exercises", confirmVerb = "Add" }) {
  const [q, setQ] = useState("");
  const [muscle, setMuscle] = useState("all");
  const [picked, setPicked] = useState([]);
  const [creating, setCreating] = useState(false);
  const term = useDebouncedValue(q.trim(), 200);
  const list = useExercises({ q: term || undefined, muscle, status: "active", limit: 200 }, { enabled: open });

  useEffect(() => {
    if (!open) return;
    setQ("");
    setMuscle("all");
    setPicked([]);
  }, [open]);

  const isPicked = (e) => picked.some((p) => p._id === e._id);
  const toggle = (e) => setPicked((prev) => (prev.some((p) => p._id === e._id) ? prev.filter((p) => p._id !== e._id) : [...prev, e]));

  const confirm = () => {
    onPick(picked);
    onClose();
  };

  const items = list.data?.items || [];

  return (
    <>
      <Dialog
        open={open && !creating}
        onClose={onClose}
        title={title}
        description="Tap to choose. They're added in the order you pick them."
        placement="side"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="primary" icon={Plus} onClick={confirm} disabled={!picked.length}>
              {picked.length ? `${confirmVerb} ${picked.length} ${picked.length === 1 ? "exercise" : "exercises"}` : `${confirmVerb} exercises`}
            </Button>
          </>
        }
      >
        <div className="sticky top-0 z-10 -mx-5 flex flex-col gap-3 bg-surface px-5 pb-3 md:-mx-6 md:px-6">
          <SearchInput value={q} onChange={setQ} placeholder="Search by name" label="Search exercises" autoFocus />
          <FilterChips label="Muscle" value={muscle} onChange={setMuscle} options={MUSCLES} />
        </div>
        {list.isPending ? (
          <SkeletonList rows={6} />
        ) : list.isError && !list.data ? (
          <ErrorState compact error={list.error} onRetry={() => list.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState
            compact
            title="No exercises match"
            body={term ? `Nothing called “${term}”. Add it to the library.` : "Try another muscle."}
            action={
              <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
                {term ? `Add “${term}”` : "Add an exercise"}
              </Button>
            }
          />
        ) : (
          <>
            <ul className="flex flex-col gap-1" aria-label="Exercises">
              {items.map((e) => {
                const on = isPicked(e);
                const position = picked.findIndex((p) => p._id === e._id) + 1;
                return (
                  <li key={e._id}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => toggle(e)}
                      className={cn(
                        "flex min-h-14 w-full items-center gap-3 rounded-tile border px-3 py-2.5 text-left transition-colors",
                        on ? "border-brand bg-brand-soft" : "border-transparent hover:bg-surface-2"
                      )}
                    >
                      <span
                        className={cn(
                          "grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold",
                          on ? "border-brand bg-brand text-on-brand" : "border-line-strong text-transparent"
                        )}
                        aria-hidden
                      >
                        {on ? position : <Check className="size-3.5" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{e.name}</span>
                        <span className="block truncate text-body-sm text-ink-3">
                          {MUSCLE_LABEL[e.primaryMuscle]}, {EQUIPMENT_LABEL[e.equipment]}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-center text-body-sm text-ink-3">
              Can't find it?{" "}
              <button type="button" className="font-semibold text-brand-ink hover:underline" onClick={() => setCreating(true)}>
                Add a new exercise
              </button>
            </p>
          </>
        )}
      </Dialog>
      <ExerciseFormDialog
        open={creating}
        initialName={term}
        onClose={() => setCreating(false)}
        onSaved={(exercise) => setPicked((prev) => [...prev, exercise])}
      />
    </>
  );
}
