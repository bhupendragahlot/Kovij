import { createContext, useContext } from "react";

export const ConfirmContext = createContext(null);

/**
 * Promise-based confirmation for destructive or irreversible actions:
 *   const confirm = useConfirm();
 *   if (await confirm({ title: "Cancel plan?", confirmLabel: "Cancel plan", tone: "danger" })) …
 */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used inside <ConfirmProvider>");
  return ctx;
}
