import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/cn";
import { controlClasses } from "./styles";

/** Free-text list (plan features, trainer specialties). Enter or comma adds; Backspace on empty removes the last. */
export function TagInput({ value = [], onChange, placeholder = "Type and press Enter", max = 20, id, ...aria }) {
  const [draft, setDraft] = useState("");

  const commit = (parts) => {
    const next = [...value];
    for (const p of parts.map((s) => s.trim()).filter(Boolean)) {
      if (!next.includes(p) && next.length < max) next.push(p);
    }
    if (next.length !== value.length) onChange(next);
    setDraft("");
  };
  const add = () => commit([draft]);

  return (
    <div className={cn(controlClasses, "flex min-h-11 flex-wrap items-center gap-1.5 px-2 py-1.5 focus-within:border-focus focus-within:ring-2 focus-within:ring-focus/25 md:min-h-10")}>
      {value.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-surface-2 py-1 pl-2.5 pr-1 text-[13px] font-semibold">
          {tag}
          <button type="button" onClick={() => onChange(value.filter((t) => t !== tag))} aria-label={`Remove ${tag}`} className="grid size-5 place-items-center rounded-full text-ink-3 hover:bg-surface-3 hover:text-ink">
            <X className="size-3" aria-hidden />
          </button>
        </span>
      ))}
      <input
        id={id}
        {...aria}
        value={draft}
        onChange={(e) => (e.target.value.includes(",") ? commit(e.target.value.split(",")) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          } else if (e.key === "Backspace" && !draft && value.length) {
            onChange(value.slice(0, -1));
          }
        }}
        onBlur={add}
        placeholder={value.length ? "" : placeholder}
        className="min-w-32 flex-1 bg-transparent px-1 text-[15px] outline-none placeholder:text-ink-3 md:text-sm"
      />
    </div>
  );
}
