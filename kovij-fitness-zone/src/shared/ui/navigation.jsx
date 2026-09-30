import { useRef } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { IconButton } from "./Button";

export function PageHeader({ title, description, actions, back, className }) {
  return (
    <header className={cn("mb-5 flex flex-col gap-4 md:mb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-title font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 text-[15px] text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function SearchInput({ value, onChange, placeholder = "Search", label = "Search", className, autoFocus, onKeyDown, inputRef }) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        autoComplete="off"
        enterKeyHint="search"
        className="h-11 w-full rounded-control border border-control bg-surface pl-10 pr-10 text-[15px] text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 focus-visible:outline-none md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Horizontal filter chips with counts (e.g. Members: All · Active · Ends soon).
 * Single-select, radio semantics; scrolls sideways on phones instead of wrapping.
 */
export function FilterChips({ label, value, onChange, options, className }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0 [scrollbar-width:none]", className)}>
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors duration-150",
              selected ? "border-ink bg-ink text-canvas" : "border-line-strong bg-surface text-ink-2 hover:border-ink-3 hover:text-ink"
            )}
          >
            {o.label}
            {o.count != null && (
              <span className={cn("tabular text-xs", selected ? "text-canvas/75" : "text-ink-3")}>{formatNumber(o.count)}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Accessible tabs (arrow keys move between tabs). Panels are rendered by the caller. */
export function Tabs({ label, value, onChange, tabs, className }) {
  const onKeyDown = (e) => {
    const i = tabs.findIndex((t) => t.value === value);
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = tabs[(i + step + tabs.length) % tabs.length];
    onChange(next.value);
    e.currentTarget.querySelector(`#tab-${next.value}`)?.focus();
  };
  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("flex gap-1 overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
      {tabs.map((t) => {
        const selected = t.value === value;
        return (
          <button
            key={t.value}
            id={`tab-${t.value}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`panel-${t.value}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(t.value)}
            className={cn(
              "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors",
              selected ? "border-brand text-ink" : "border-transparent text-ink-3 hover:text-ink"
            )}
          >
            {t.label}
            {t.count != null && <span className="tabular rounded-full bg-surface-2 px-1.5 text-xs text-ink-2">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ value, children, className }) {
  return (
    <div role="tabpanel" id={`panel-${value}`} aria-labelledby={`tab-${value}`} className={className}>
      {children}
    </div>
  );
}

export function Pagination({ page, limit, total, onPage, className }) {
  if (total <= limit) return null;
  const from = (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);
  const last = Math.ceil(total / limit);
  return (
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3 border-t border-line px-4 py-3 md:px-5", className)}>
      <p className="tabular text-sm text-ink-3">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex gap-1">
        <IconButton icon={ChevronLeft} label="Previous page" variant="secondary" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        <IconButton icon={ChevronRight} label="Next page" variant="secondary" size="sm" disabled={page >= last} onClick={() => onPage(page + 1)} />
      </div>
    </nav>
  );
}
