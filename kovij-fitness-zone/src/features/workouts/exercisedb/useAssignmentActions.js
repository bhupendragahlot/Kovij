import { useCancelExerciseAssignment, useSetExerciseDone } from "./api";
import { useConfirm, useToast } from "../../../shared/ui";

/** Mark done / not done and remove, with confirmation and messages. */
export function useAssignmentActions() {
  const setDone = useSetExerciseDone();
  const cancel = useCancelExerciseAssignment();
  const confirm = useConfirm();
  const toast = useToast();
  return {
    busy: setDone.isPending || cancel.isPending,
    toggleDone: (a) =>
      setDone.mutate(
        { id: a._id, done: a.status !== "completed" },
        {
          onSuccess: () => toast.success(a.status === "completed" ? `${a.exercise.name} marked not done` : `${a.exercise.name} marked done`),
          onError: (e) => toast.error("Couldn't update it", { description: e.message }),
        }
      ),
    remove: async (a) => {
      const ok = await confirm({
        title: `Remove ${a.exercise.name}?`,
        body: "It comes off the member's list. A record stays in the history.",
        confirmLabel: "Remove exercise",
        tone: "danger",
      });
      if (!ok) return;
      cancel.mutate(a._id, {
        onSuccess: () => toast.success(`${a.exercise.name} removed`),
        onError: (e) => toast.error("Couldn't remove it", { description: e.message }),
      });
    },
  };
}
