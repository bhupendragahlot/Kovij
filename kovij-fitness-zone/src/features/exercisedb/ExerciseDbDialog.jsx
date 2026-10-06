import { Dialog } from "../../shared/ui";
import { ExerciseDbDetail } from "./ExerciseDbDetail";
import { exerciseFacts } from "./format";

/**
 * One exercise in a side drawer (bottom sheet on phones). `exercise` is what the caller already has
 * (a search result or a saved snapshot); `query` loads the full record. `children` sit above the
 * facts (e.g. what the trainer asked for); `footer` holds actions.
 */
export function ExerciseDbDialog({ open, onClose, exercise, query, footer, children }) {
  const name = query.data?.name || exercise?.name || "Exercise";
  return (
    <Dialog open={open} onClose={onClose} title={name} description={exercise ? exerciseFacts(exercise) : undefined} placement="side" size="md" footer={footer}>
      {open && (
        <ExerciseDbDetail query={query} fallback={exercise}>
          {children}
        </ExerciseDbDetail>
      )}
    </Dialog>
  );
}
