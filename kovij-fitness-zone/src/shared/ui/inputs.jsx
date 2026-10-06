import { Check, ChevronDown } from "lucide-react";
import { cn } from "../lib/cn";
import { CONTROL_HEIGHT, controlClasses } from "./styles";

/**
 * Text input. `icon` renders a leading icon, `prefix` leading text (e.g. "₹"),
 * `suffix` trailing text (e.g. "kg").
 */
export function Input({ icon: Icon, prefix, suffix, className, ref, ...props }) {
  if (!Icon && !prefix && !suffix) {
    return <input ref={ref} className={cn(controlClasses, CONTROL_HEIGHT, "px-3", className)} {...props} />;
  }
  const leading = Icon || prefix;
  return (
    <div className="relative">
      {Icon && <Icon className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />}
      {prefix && !Icon && (
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-ink-3 md:text-sm" aria-hidden>
          {prefix}
        </span>
      )}
      <input
        ref={ref}
        className={cn(controlClasses, CONTROL_HEIGHT, leading ? (Icon ? "pl-10" : "pl-8") : "pl-3", suffix ? "pr-12" : "pr-3", className)}
        {...props}
      />
      {suffix && <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-body-sm text-ink-3">{suffix}</span>}
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
      <select ref={ref} className={cn(controlClasses, CONTROL_HEIGHT, "appearance-none pl-3 pr-9", className)} {...props}>
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />
    </div>
  );
}

/**
 * On/off setting (Material 3 switch: 52 × 32 track; the thumb grows and shows a tick when on).
 * The whole row is the label, so it taps comfortably; the switch role carries the state.
 */
export function Switch({ checked, onChange, label, description, disabled, id }) {
  return (
    <label className={cn("flex min-h-12 cursor-pointer items-center justify-between gap-4", disabled && "cursor-not-allowed opacity-40")}>
      <span className="min-w-0 py-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {description && <span className="mt-0.5 block text-body-sm text-ink-3">{description}</span>}
      </span>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-8 w-[52px] shrink-0 items-center rounded-full border-2 transition-colors duration-200",
          checked ? "border-brand bg-brand" : "border-control bg-surface-3"
        )}
      >
        <span
          className={cn(
            "absolute grid place-items-center rounded-full transition-all duration-200 ease-[var(--ease-snap)]",
            checked ? "left-[22px] size-6 bg-white shadow-sm" : "left-[6px] size-4 bg-control"
          )}
        >
          {checked && <Check className="size-3.5 text-brand-ink" strokeWidth={3} aria-hidden />}
        </span>
      </button>
    </label>
  );
}

/**
 * Pick one of a few options (payment mode, date range, sub-views). Material 3 segmented
 * button: one outlined pill, the chosen segment filled with the soft brand colour.
 * Radio-group semantics, so arrow keys move between options and screen readers announce "1 of 3".
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
      className={cn("inline-flex max-w-full rounded-full border border-control bg-surface", block && "flex w-full", className)}
    >
      {options.map((o, i) => {
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
              // Rounded ends instead of overflow-hidden on the group, so the 48 px touch area isn't clipped.
              "state-layer touch-target inline-flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors duration-150",
              size === "sm" ? "h-[30px] px-3 text-body-sm" : "h-[38px] px-4 text-sm",
              i > 0 && "border-l border-control",
              i === 0 && "rounded-l-full",
              i === options.length - 1 && "rounded-r-full",
              block && "flex-1",
              selected ? "bg-brand-soft text-brand-ink" : "text-ink-2"
            )}
          >
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : selected && options.length <= 3 && <Check className="size-4 shrink-0" aria-hidden />}
            <span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
