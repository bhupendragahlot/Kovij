import { useState } from "react";
import { Check, X } from "lucide-react";
import { useMembers } from "../members/api";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { Avatar, SearchInput, StatusBadge } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatPhone } from "../../shared/lib/format";

/**
 * Choose several members by searching. Chosen members show as removable chips above the search.
 * `value` is an array of member objects ({ _id, name, … }).
 */
export function MemberMultiPicker({ value, onChange, error, max = 50, label = "Members" }) {
  const [q, setQ] = useState("");
  const term = useDebouncedValue(q.trim(), 200);
  const results = useMembers({ q: term, limit: 8 }, { enabled: term.length >= 2 });
  const options = results.data?.members || [];
  const chosen = new Set(value.map((m) => m._id));

  const toggle = (m) => {
    if (chosen.has(m._id)) onChange(value.filter((v) => v._id !== m._id));
    else if (value.length < max) onChange([...value, m]);
  };

  return (
    <div className="flex flex-col gap-2">
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={`Chosen ${label.toLowerCase()}`}>
          {value.map((m) => (
            <li key={m._id} className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2 pl-1.5 pr-1 md:h-10">
              <Avatar name={m.name} src={m.profilePhoto} size="sm" />
              <span className="max-w-40 truncate text-sm font-semibold">{m.name}</span>
              <button
                type="button"
                onClick={() => toggle(m)}
                aria-label={`Remove ${m.name}`}
                className="grid size-9 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink"
              >
                <X className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <SearchInput value={q} onChange={setQ} label={`Search ${label.toLowerCase()}`} placeholder="Name, phone or member code" />
      {error && <p className="text-[13px] font-medium text-bad">{error}</p>}
      {term.length >= 2 && (
        <ul className="flex flex-col gap-0.5 rounded-tile border border-line p-1" aria-label="Search results">
          {results.isPending && <li className="px-3 py-2 text-sm text-ink-3">Searching…</li>}
          {!results.isPending && options.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">No member matches “{term}”.</li>}
          {options.map((m) => {
            const on = chosen.has(m._id);
            return (
              <li key={m._id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(m)}
                  disabled={!on && value.length >= max}
                  className={cn("flex min-h-12 w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left hover:bg-surface-2 disabled:opacity-50", on && "bg-brand-soft")}
                >
                  <Avatar name={m.name} src={m.profilePhoto} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{m.name}</span>
                    <span className="block truncate text-xs text-ink-3">{[m.memberCode, formatPhone(m.phone)].filter(Boolean).join(", ")}</span>
                  </span>
                  <StatusBadge kind="member" status={m.state} size="sm" />
                  <span
                    className={cn("grid size-6 shrink-0 place-items-center rounded-full border", on ? "border-brand bg-brand text-on-brand" : "border-line-strong text-transparent")}
                    aria-hidden
                  >
                    <Check className="size-3.5" />
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
