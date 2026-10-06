import { useState } from "react";
import { Dumbbell } from "lucide-react";
import { cn } from "../../shared/lib/cn";

/**
 * An ExerciseDB GIF or image, with a plain placeholder when there is none or it fails to load
 * (ExerciseDB rotates media links weekly, so an old page can hold a dead link).
 */
export function ExerciseDbMedia({ src, alt = "", className, iconClassName = "size-8", eager = false }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div
        className={cn("grid place-items-center bg-surface-2 text-ink-3", className)}
        aria-hidden={!alt || undefined}
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
      >
        <Dumbbell className={iconClassName} aria-hidden />
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading={eager ? "eager" : "lazy"}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      // GIFs are drawn on white; keep them white in dark mode too so they stay readable.
      className={cn("bg-white object-contain", className)}
    />
  );
}
