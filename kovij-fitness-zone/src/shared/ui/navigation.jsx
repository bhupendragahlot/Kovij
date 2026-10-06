import { useRef } from "react";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../lib/cn";
import { formatNumber } from "../lib/format";
import { IconButton } from "./Button";
import { chipClasses } from "./styles";

/**
 * The page's title row, directly under the app bar (Material "medium top app bar" shape):
 * 22 px on phones, 26 px from 600 px. Actions wrap under the title on phones.
 */
export function PageHeader({ title, description, actions, back, className }) {
  return (
    <header className={cn("mb-4 flex flex-col gap-3 sm:mb-6 md:flex-row md:items-end md:justify-between", className)}>
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="state-layer touch-target -ml-2 mb-1 inline-flex h-9 items-center gap-1 rounded-full pl-2 pr-3 text-sm font-semibold text-ink-2 hover:text-ink"
          >
            <ArrowLeft className="size-5" aria-hidden />
            {back.label}
          </Link>
        )}
        <h1 className="text-headline-sm font-bold text-ink sm:text-headline">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-3">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/** Material search bar: a pill with a leading search icon and a clear button. */
export function SearchInput({ value, onChange, placeholder = "Search", label = "Search", className, autoFocus, onKeyDown, inputRef }) {
  const localRef = useRef(null);
  const ref = inputRef || localRef;
  return (
    <div className={cn("relative", className)}>
      <Search className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-ink-3" aria-hidden />
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
        className="h-11 w-full rounded-full border border-control bg-surface pl-11 pr-11 text-base text-ink placeholder:text-ink-3 hover:border-ink-3 focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/25 focus-visible:outline-none md:h-10 md:text-sm [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => {
            onChange("");
            ref.current?.focus();
          }}
          className="absolute right-1.5 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink active:bg-surface-3"
        >
          <X className="size-[18px]" aria-hidden />
        </button>
      )}
    </div>
  );
}

/**
 * Material filter chips with counts (e.g. Members: All · Active · Ends soon): 32 px tall,
 * 8 px corners, a tick on the chosen one. Single-select, radio semantics; scrolls sideways on
 * phones instead of wrapping (edge to edge within the 16 px page margin).
 */
export function FilterChips({ label, value, onChange, options, className }) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none]", className)}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={chipClasses(selected, selected && "pl-2")}
          >
            {selected && <Check className="size-4" aria-hidden />}
            {o.label}
            {o.count != null && <span className={cn("tabular text-label", selected ? "opacity-80" : "text-ink-3")}>{formatNumber(o.count)}</span>}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Material primary tabs (arrow keys move between them). 48 px tall with a 3 px indicator.
 * Up to four tabs share the width equally on phones (fixed tabs); more scroll sideways.
 * Panels are rendered by the caller.
 */
export function Tabs({ label, value, onChange, tabs, className }) {
  const fixed = tabs.length <= 4;
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
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={cn("flex overflow-x-auto border-b border-line [scrollbar-width:none]", className)}>
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
              "state-layer no-callout inline-flex h-12 shrink-0 items-center justify-center gap-2 whitespace-nowrap px-4 text-sm font-semibold transition-colors",
              fixed && "max-sm:min-w-0 max-sm:flex-1 max-sm:px-2",
              selected ? "text-brand-ink" : "text-ink-2 hover:text-ink"
            )}
          >
            {t.label}
            {t.count != null && <span className="tabular rounded-full bg-surface-2 px-1.5 text-label text-ink-2">{t.count}</span>}
            {selected && <span className="absolute inset-x-2 bottom-0 h-[3px] rounded-t-full bg-brand" aria-hidden />}
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
    <nav aria-label="Pagination" className={cn("flex items-center justify-between gap-3 border-t border-line px-4 py-2 sm:px-5", className)}>
      <p className="tabular text-body-sm text-ink-3">
        {formatNumber(from)}–{formatNumber(to)} of {formatNumber(total)}
      </p>
      <div className="flex gap-2">
        <IconButton icon={ChevronLeft} label="Previous page" variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} />
        <IconButton icon={ChevronRight} label="Next page" variant="secondary" disabled={page >= last} onClick={() => onPage(page + 1)} />
      </div>
    </nav>
  );
}
