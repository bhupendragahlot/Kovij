import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { useConfirm } from "../ui/confirmContext";

/**
 * Warn before leaving a form with unsaved edits, both for in-app navigation and for
 * closing or reloading the tab.
 */
export function useUnsavedChangesGuard(isDirty) {
  const confirm = useConfirm();
  const blocker = useBlocker(({ currentLocation, nextLocation }) => isDirty && currentLocation.pathname !== nextLocation.pathname);

  useEffect(() => {
    if (blocker.state !== "blocked") return;
    let active = true;
    confirm({
      title: "Discard your changes?",
      body: "You have entered details that are not saved yet.",
      confirmLabel: "Discard changes",
      cancelLabel: "Keep editing",
      tone: "danger",
    }).then((ok) => {
      if (!active) return;
      if (ok) blocker.proceed();
      else blocker.reset();
    });
    return () => {
      active = false;
    };
  }, [blocker, confirm]);

  useEffect(() => {
    if (!isDirty) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [isDirty]);
}
