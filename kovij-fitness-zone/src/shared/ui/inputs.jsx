import { ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { controlClasses } from "./styles";

/**
 * Text input. `icon` renders a leading icon, `prefix` leading text (e.g. "₹"),
 * `suffix` trailing text (e.g. "kg").
 */
export function Input({ icon: Icon, prefix, suffix, className, ref, ...props }) {
  if (!Icon && !prefix && !suffix) {
    return <input ref={ref} className={cn(controlClasses, "h-11 px-3 md:h-10", className)} {...props} />;
  }
  const leading = Icon || prefix;
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />}
      {prefix && !Icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-ink-3 md:text-sm" aria-hidden>
          {prefix}
        </span>
      )}
      <input ref={ref} className={cn(controlClasses, "h-11 md:h-10", leading ? "pl-8" : "pl-3", suffix ? "pr-12" : "pr-3", className)} {...props} />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-3">{suffix}</span>}
    </div>
  );
}

export function Textarea({ className, rows = 3, ref, ...props }) {
  return <textarea ref={ref} rows={rows} className={cn(controlClasses, "min-h-20 px-3 py-2.5 leading-relaxed", className)} {...props} />;
}

/** Native select (best mobile UX: the OS picker) with the design-system frame. */
export function Select({ className, children, placeholder, ref, ...props }) {
  return (
    <div className="relative">
      <select ref={ref} className={cn(controlClasses, "h-11 appearance-none pl-3 pr-9 md:h-10", className)} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

/** On/off setting. Renders a real switch role with the label as its accessible name. */
export function Switch({ checked, onChange, label, description, disabled, id }) {
  return (
    <label className={cn("flex cursor-pointer items-start justify-between gap-4", disabled && "cursor-not-allowed opacity-60")}>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative mt-0.5 inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-150",
          checked ? "bg-brand" : "bg-surface-3"
        )}
      >
        <span
          className={cn(
            "inline-block size-5 rounded-full bg-white shadow transition-transform duration-150 ease-[var(--ease-snap)]",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      </button>
    </label>
  );
}

/**
 * Pick one of a few options (payment mode, date range). Radio-group semantics, so arrow keys
 * move between options and screen readers announce "1 of 3".
 */
export function SegmentedControl({ label, value, onChange, options, size = "md", className, block = false }) {
  const onKeyDown = (e) => {
    const i = options.findIndex((o) => o.value === value);
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = options[(i + step + options.length) % options.length];
    onChange(next.value);
    e.currentTarget.querySelector(`[data-value="${next.value}"]`)?.focus();
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      onKeyDown={onKeyDown}
      className={cn("inline-flex gap-1 rounded-control bg-surface-2 p-1", block && "flex w-full", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            data-value={o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex items-center justify-center gap-1.5 rounded-[9px] font-semibold transition-colors duration-150",
              size === "sm" ? "h-8 px-3 text-[13px]" : "h-10 px-3.5 text-sm md:h-9",
              block && "flex-1",
              selected ? "bg-surface text-ink shadow-sm dark:bg-surface-3" : "text-ink-2 hover:text-ink"
            )}
          >
            {Icon && <Icon className="size-4" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
