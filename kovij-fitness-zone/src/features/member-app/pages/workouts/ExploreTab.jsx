import { useState } from "react";
import { memberExerciseDb, useLibraryExercise } from "../../queries";
import { ExerciseDbBrowser } from "../../../exercisedb/ExerciseDbBrowser";
import { ExerciseDbDialog } from "../../../exercisedb/ExerciseDbDialog";
import { Button, Card } from "../../../../shared/ui";

/** Member app → Workouts → Explore: search ExerciseDB by name, body part, muscle or equipment. */
export function ExploreTab() {
  const [open, setOpen] = useState(null);
  const detail = useLibraryExercise(open?.id);
  return (
    <>
      <Card>
        <ExerciseDbBrowser api={memberExerciseDb} onOpen={setOpen} />
      </Card>
      <ExerciseDbDialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        exercise={open}
        query={detail}
        footer={
          <Button block variant="secondary" onClick={() => setOpen(null)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-ink-3">Not sure about the form? Ask a trainer on the floor before trying it with weight.</p>
      </ExerciseDbDialog>
    </>
  );
}
