import { useMemo } from "react";
import { useDispatch } from "react-redux";
import { nanoid } from "@reduxjs/toolkit";
import { toastActionRegistry, toastAdded } from "./toastSlice";

/**
 * const toast = useToast();
 * toast.success("Payment recorded", { description: "Receipt KFZ-2026-00042" });
 * toast.success("Checked in", { action: { label: "Undo", onClick: undo } });
 */
export function useToast() {
  const dispatch = useDispatch();
  return useMemo(() => {
    const show = (tone) => (title, { description, action, duration } = {}) => {
      const id = nanoid();
      if (action) toastActionRegistry.set(id, action.onClick);
      dispatch(toastAdded({ id, tone, title, description, actionLabel: action?.label, duration }));
      return id;
    };
    return {
      success: show("success"),
      error: show("danger"),
      info: show("neutral"),
      warning: show("warning"),
    };
  }, [dispatch]);
}
