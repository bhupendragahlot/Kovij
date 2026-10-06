import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { IconButton } from "./Button";

/** Widths from the expanded breakpoint (840 px). Below it every dialog is a bottom sheet. */
const WIDTHS = { sm: "md:max-w-md", md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl" };

/**
 * Modal built on the native <dialog> element: focus is trapped, Esc closes, the page
 * behind is inert, and focus returns to the trigger on close.
 *
 * Responsive shape (Material 3):
 *   < 840 px              bottom sheet: up to 640 px wide, 28 px top corners, drag handle,
 *                         actions side by side at the bottom (thumb reach), safe-area aware
 *   placement="center"    centred dialog from 840 px, 28 px corners
 *   placement="side"      right-hand side sheet from 840 px, full height
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  placement = "center",
  dismissible = true,
  initialFocusRef,
  className,
}) {
  const ref = useRef(null);
  const titleId = useId();
  const descId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      el.showModal();
      initialFocusRef?.current?.focus();
    } else if (!open && el.open) {
      el.close();
    }
  }, [open, initialFocusRef]);

  const requestClose = () => {
    if (dismissible) onClose?.();
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      data-placement={placement}
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose();
      }}
      className={cn(
        "kv-app font-ui text-ink bg-surface backdrop:bg-black/50",
        "fixed flex-col overflow-hidden p-0 shadow-pop open:flex",
        // compact + medium: bottom sheet
        "inset-x-0 bottom-0 top-auto mx-auto my-0 max-h-[92dvh] w-full max-w-[640px] rounded-t-hero",
        placement === "center"
          ? cn("md:inset-0 md:m-auto md:h-fit md:max-h-[85dvh] md:rounded-hero", WIDTHS[size])
          : cn("md:inset-y-0 md:left-auto md:right-0 md:mr-0 md:h-dvh md:max-h-none md:rounded-none md:rounded-l-card", WIDTHS[size]),
        "kv-dialog",
        className
      )}
    >
      {open && (
        <>
          <div className="mx-auto mt-3 h-1 w-8 shrink-0 rounded-full bg-control/60 md:hidden" aria-hidden />
          <header className="flex shrink-0 items-start justify-between gap-3 px-4 pb-3 pt-3 sm:px-6 md:pt-5">
            <div className="min-w-0 pt-1">
              <h2 id={titleId} className="text-title-lg font-bold text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-body-sm text-ink-3">
                  {description}
                </p>
              )}
            </div>
            {dismissible && <IconButton icon={X} label="Close" onClick={requestClose} className="-mr-2" />}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 sm:px-6 sm:pb-6">{children}</div>
          {footer && (
            <footer
              className={cn(
                "flex shrink-0 flex-wrap items-center gap-2 border-t border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6",
                // Phones: actions share the row (Cancel left, main action right, under the thumb).
                "[&>*]:min-w-[7.5rem] [&>*]:flex-1 md:justify-end md:[&>*]:min-w-16 md:[&>*]:flex-none md:pb-4"
              )}
            >
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}
