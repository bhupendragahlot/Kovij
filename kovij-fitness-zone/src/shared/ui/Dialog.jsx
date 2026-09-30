import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { IconButton } from "./Button";

const WIDTHS = { sm: "md:max-w-md", md: "md:max-w-lg", lg: "md:max-w-2xl", xl: "md:max-w-4xl" };

/**
 * Modal built on the native <dialog> element: focus is trapped, Esc closes, the page
 * behind is inert, and focus returns to the trigger on close.
 *
 * Responsive shape:
 *   placement="center" → bottom sheet on phones, centred dialog from tablet up
 *   placement="side"   → bottom sheet on phones, right-hand drawer from tablet up
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
      onCancel={(e) => {
        e.preventDefault();
        requestClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) requestClose();
      }}
      className={cn(
        "kv-app font-ui text-ink bg-surface backdrop:bg-black/55 backdrop:backdrop-blur-[2px]",
        "fixed m-0 flex-col overflow-hidden p-0 shadow-pop open:flex",
        // phone: bottom sheet
        "inset-x-0 bottom-0 top-auto max-h-[92dvh] w-full max-w-none rounded-t-[24px]",
        placement === "center"
          ? cn("md:inset-0 md:m-auto md:h-fit md:max-h-[85dvh] md:rounded-card", WIDTHS[size])
          : cn("md:inset-y-0 md:left-auto md:right-0 md:h-dvh md:max-h-none md:rounded-none md:rounded-l-card", WIDTHS[size]),
        "kv-dialog",
        className
      )}
    >
      {open && (
        <>
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-strong md:hidden" aria-hidden />
          <header className="flex shrink-0 items-start justify-between gap-4 px-5 pb-3 pt-4 md:px-6 md:pt-5">
            <div className="min-w-0">
              <h2 id={titleId} className="text-lg font-bold tracking-tight text-ink">
                {title}
              </h2>
              {description && (
                <p id={descId} className="mt-1 text-sm text-ink-3">
                  {description}
                </p>
              )}
            </div>
            {dismissible && <IconButton icon={X} label="Close" size="sm" onClick={requestClose} className="-mr-2 -mt-1" />}
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 md:px-6">{children}</div>
          {footer && (
            <footer className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-surface px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end md:px-6">
              {footer}
            </footer>
          )}
        </>
      )}
    </dialog>
  );
}
