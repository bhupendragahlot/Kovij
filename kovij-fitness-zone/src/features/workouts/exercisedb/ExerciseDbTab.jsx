import { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { staffExerciseDb, useExerciseDbExercise } from "./api";
import { AssignExercisesDialog } from "./AssignExercisesDialog";
import { ExerciseDbBrowser } from "../../exercisedb/ExerciseDbBrowser";
import { ExerciseDbDialog } from "../../exercisedb/ExerciseDbDialog";
import { Button, Card } from "../../../shared/ui";

/** Exercise library → ExerciseDB: search the catalogue, open an exercise, assign it to a member. */
export function ExerciseDbTab() {
  const [open, setOpen] = useState(null);
  const [assigning, setAssigning] = useState(null);
  const detail = useExerciseDbExercise(open?.id);

  return (
    <>
      <Card>
        <ExerciseDbBrowser
          api={staffExerciseDb}
          onOpen={setOpen}
          renderAction={(e) => (
            <Button size="sm" variant="secondary" block icon={CalendarPlus} onClick={() => setAssigning([e])}>
              Assign
            </Button>
          )}
        />
      </Card>
      <ExerciseDbDialog
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        exercise={open}
        query={detail}
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(null)}>
              Close
            </Button>
            <Button variant="primary" icon={CalendarPlus} onClick={() => (setAssigning([open]), setOpen(null))}>
              Assign to a member
            </Button>
          </>
        }
      />
      <AssignExercisesDialog open={Boolean(assigning)} onClose={() => setAssigning(null)} exercises={assigning || []} />
    </>
  );
}
