import { useId, useState } from "react";
import { X } from "lucide-react";
import { useMembers } from "./api";
import { useDebouncedValue } from "../../shared/hooks/useDebouncedValue";
import { MemberStateBadge } from "./StatusBadges";
import { Avatar, SearchInput } from "../../shared/ui";
import { cn } from "../../shared/lib/cn";
import { formatPhone } from "../../shared/lib/format";

/**
 * Pick one member by searching. Once chosen, shows the member as a removable chip.
 * Combobox semantics: arrows move through matches, Enter selects. `excludeId` hides one member
 * (e.g. the member being edited, when picking who referred them).
 */
export function MemberPicker({ value, onChange, error, label = "Member", excludeId }) {
  const listId = useId();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const term = useDebouncedValue(q.trim(), 200);
  const results = useMembers({ q: term, limit: 6 }, { enabled: !value && term.length >= 2 });
  const options = (results.data?.members || []).filter((m) => m._id !== excludeId);

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-tile border border-line-strong bg-surface-2 p-2.5">
        <Avatar name={value.name} src={value.profilePhoto} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{value.name}</p>
          <p className="truncate text-xs text-ink-3">{[value.memberCode, formatPhone(value.phone)].filter(Boolean).join(", ")}</p>
        </div>
        <button type="button" onClick={() => onChange(null)} aria-label={`Change ${label.toLowerCase()}`} className="grid size-8 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
          <X className="size-4" aria-hidden />
        </button>
      </div>
    );
  }

  const choose = (m) => {
    onChange(m);
    setQ("");
  };

  return (
    <div>
      <div
        role="combobox"
        aria-expanded={options.length > 0}
        aria-controls={listId}
        aria-haspopup="listbox"
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") (e.preventDefault(), setActive((i) => Math.min(i + 1, options.length - 1)));
          if (e.key === "ArrowUp") (e.preventDefault(), setActive((i) => Math.max(i - 1, 0)));
          if (e.key === "Enter" && options[active]) (e.preventDefault(), choose(options[active]));
        }}
      >
        <SearchInput value={q} onChange={(v) => (setQ(v), setActive(0))} label={`Search ${label.toLowerCase()}`} placeholder="Name, phone or member code" />
      </div>
      {error && <p className="mt-1.5 text-[13px] font-medium text-bad">{error}</p>}
      {term.length >= 2 && (
        <ul id={listId} role="listbox" className="mt-2 flex flex-col gap-0.5 rounded-tile border border-line p-1">
          {results.isPending && <li className="px-3 py-2 text-sm text-ink-3">Searching…</li>}
          {!results.isPending && options.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">No member matches “{term}”.</li>}
          {options.map((m, i) => (
            <li key={m._id} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => choose(m)}
                onMouseEnter={() => setActive(i)}
                className={cn("flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left", i === active && "bg-surface-2")}
              >
                <Avatar name={m.name} src={m.profilePhoto} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{m.name}</span>
                  <span className="block truncate text-xs text-ink-3">{[m.memberCode, formatPhone(m.phone)].filter(Boolean).join(", ")}</span>
                </span>
                <MemberStateBadge status={m.state} size="sm" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
