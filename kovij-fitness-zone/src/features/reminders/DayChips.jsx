import { useId } from "react";
import { Check } from "lucide-react";
import { cn } from "../../shared/lib/cn";

/**
 * Pick several day counts from a fixed list (e.g. remind 7, 3 and 1 day before). Toggle
 * buttons with aria-pressed; once `max` are picked the rest are disabled and the hint says why.
 */
export function DayChips({ label, hint, error, value = [], onChange, options, max = 6, disabled = false, suffix = (n) => (n === 1 ? "1 day" : `${n} days`) }) {
  const id = useId();
  const full = value.length >= max;
  // Keep any saved value that isn't one of the presets visible, so it can be turned off.
  const choices = [...new Set([...options, ...value])].sort((a, b) => a - b);
  const toggle = (n) => {
    if (value.includes(n)) onChange(value.filter((v) => v !== n));
    else if (!full) onChange([...value, n].sort((a, b) => a - b));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <p id={`${id}-label`} className="text-sm font-semibold text-ink">
        {label}
      </p>
      <div role="group" aria-labelledby={`${id}-label`} aria-describedby={`${id}-hint`} className="flex flex-wrap gap-2">
        {choices.map((n) => {
          const on = value.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              disabled={disabled || (!on && full)}
              onClick={() => toggle(n)}
              className={cn(
                "inline-flex h-11 min-w-16 items-center justify-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150 md:h-9",
                "disabled:cursor-not-allowed disabled:opacity-50",
                on ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
              )}
            >
              {on && <Check className="size-3.5" aria-hidden strokeWidth={2.6} />}
              {suffix(n)}
            </button>
          );
        })}
      </div>
      <p id={`${id}-hint`} className={cn("text-[13px]", error ? "font-medium text-bad" : "text-ink-3")}>
        {error || (full && !disabled ? `That's the most you can pick (${max}). Remove one to choose another.` : hint)}
      </p>
    </div>
  );
}
