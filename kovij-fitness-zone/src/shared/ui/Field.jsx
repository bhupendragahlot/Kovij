import { cloneElement, isValidElement, useId } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "../lib/cn";

/**
 * Label + control + hint + error, wired for assistive tech: the control receives `id`,
 * `aria-describedby` and `aria-invalid` automatically.
 *
 *   <Field label="Phone" error={errors.phone} required><Input … /></Field>
 */
export function Field({ label, hint, error, required, optional, className, children, labelAction }) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id: children.props.id || id,
        "aria-describedby": describedBy,
        "aria-invalid": error ? true : undefined,
        required: required || children.props.required,
      })
    : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-2">
          <label htmlFor={children?.props?.id || id} className="text-sm font-semibold text-ink">
            {label}
            {optional && <span className="ml-1 font-normal text-ink-3">(optional)</span>}
          </label>
          {labelAction}
        </div>
      )}
      {control}
      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-body-sm font-medium text-bad">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-body-sm text-ink-3">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
