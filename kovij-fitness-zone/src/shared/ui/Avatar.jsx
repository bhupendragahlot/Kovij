import { useState } from "react";
import { cn } from "../lib/cn";
import { initials } from "../lib/format";

const SIZES = { sm: "size-8 text-[11px]", md: "size-10 text-[13px]", lg: "size-14 text-lg", xl: "size-20 text-2xl" };

/** Photo when available (and loadable), otherwise initials. Decorative: the name is always shown beside it. */
export function Avatar({ name, src, size = "md", className }) {
  const [failed, setFailed] = useState(false);
  const showPhoto = src && !failed;
  return (
    <span
      className={cn(
        "inline-grid shrink-0 place-items-center overflow-hidden rounded-full bg-surface-3 font-bold text-ink-2",
        SIZES[size],
        className
      )}
      aria-hidden
    >
      {showPhoto ? (
        <img src={src} alt="" className="size-full object-cover" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
