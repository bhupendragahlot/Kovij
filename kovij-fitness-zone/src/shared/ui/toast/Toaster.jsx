import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { cn } from "../../lib/cn";
import { selectToasts, toastActionRegistry, toastDismissed } from "./toastSlice";

const TONE = {
  success: { icon: CircleCheck, iconClass: "text-good" },
  danger: { icon: CircleAlert, iconClass: "text-bad" },
  warning: { icon: TriangleAlert, iconClass: "text-warn" },
  neutral: { icon: Info, iconClass: "text-info" },
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
      className="kv-toast pointer-events-auto flex w-full items-start gap-3 rounded-tile border border-line bg-surface p-3.5 pr-2 text-ink shadow-float"
    >
      <Icon className={cn("mt-0.5 size-5 shrink-0", iconClass)} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description && <p className="mt-0.5 text-[13px] text-ink-2">{toast.description}</p>}
      </div>
      {toast.actionLabel && (
        <button
          type="button"
          onClick={() => {
            toastActionRegistry.get(toast.id)?.();
            dismiss();
          }}
          className="rounded-[9px] px-2.5 py-1.5 text-sm font-bold text-brand-ink hover:bg-surface-2"
        >
          {toast.actionLabel}
        </button>
      )}
      <button type="button" onClick={dismiss} aria-label="Dismiss" className="rounded-[9px] p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink">
        <X className="size-4" aria-hidden />
      </button>
    </li>
  );
}

/** Live region for toasts. Sits above the phone bottom navigation. */
export function Toaster() {
  const toasts = useSelector(selectToasts);
  return (
    <div
      role="region"
      aria-label="Notifications"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-[60] flex justify-center px-4 md:bottom-6 md:justify-end md:px-6"
    >
      <ol aria-live="polite" className="flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <Toast key={t.id} toast={t} />
        ))}
      </ol>
    </div>
  );
}
