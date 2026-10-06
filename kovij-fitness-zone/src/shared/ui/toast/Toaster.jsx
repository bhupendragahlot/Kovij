import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { selectToasts, toastActionRegistry, toastDismissed } from "./toastSlice";

const TONE = {
  success: { icon: CircleCheck, iconClass: "text-inverse-good" },
  danger: { icon: CircleAlert, iconClass: "text-inverse-bad" },
  warning: { icon: TriangleAlert, iconClass: "text-inverse-warn" },
  neutral: { icon: Info, iconClass: "text-inverse-info" },
};

function Toast({ toast }) {
  const dispatch = useDispatch();
  const timer = useRef(null);
  const { icon: Icon, iconClass } = TONE[toast.tone] || TONE.neutral;

  const dismiss = () => {
    toastActionRegistry.delete(toast.id);
    dispatch(toastDismissed(toast.id));
  };
  const start = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(dismiss, toast.duration);
  };
  const pause = () => clearTimeout(timer.current);

  useEffect(() => {
    start();
    return pause;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast.id]);

  return (
    <li
      onMouseEnter={pause}
      onMouseLeave={start}
      onFocus={pause}
      onBlur={start}
      className="kv-toast pointer-events-auto flex w-full items-start gap-3 rounded-tile bg-inverse py-3 pl-4 pr-2 text-inverse-ink shadow-float"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-body-sm text-inverse-ink-2">{toast.description}</p>}
      </div>
      {toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            toastActionRegistry.get(toast.id)?.();
            dismiss();
          }}
          className="state-layer touch-target shrink-0 rounded-full px-3 py-2 text-sm font-bold text-inverse-brand"
        >
          {toast.actionLabel}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="state-layer touch-target grid size-8 shrink-0 place-items-center rounded-full text-inverse-ink-2">
        <X className="size-[18px]" aria-hidden />
      </button>
    </li>
  );
}

/** Live region for toasts (Material snackbars on the inverse surface). Sits 12 px above the phone navigation bar. */
export function Toaster() {
  const toasts = useSelector(selectToasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--kv-navbar-h)+0.75rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 sm:bottom-6 sm:justify-end sm:px-6"
    >
      <ol aria-live="polite" className="flex w-full max-w-[25rem] flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </ol>
    </div>
  );
}
