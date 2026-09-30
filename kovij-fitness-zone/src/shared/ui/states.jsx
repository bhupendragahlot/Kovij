import { CloudOff, RefreshCw, ShieldCheck, TriangleAlert } from "lucide-react";
import { cn } from "../lib/cn";
import { Button } from "./Button";

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse rounded-[8px] bg-surface-3", className)} aria-hidden />;
}

/** Placeholder rows shaped like the content they stand in for. */
export function SkeletonList({ rows = 5, className }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-2/5" />
            <Skeleton className="h-3 w-1/4" />
          </div>
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** An empty screen is an invitation to act: say what goes here and offer the first step. */
export function EmptyState({ icon: Icon, title, body, action, className, compact = false }) {
  return (
    <div className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      {Icon && (
        <div className="mb-4 grid size-12 place-items-center rounded-tile bg-surface-2 text-ink-2">
          <Icon className="size-6" aria-hidden />
        </div>
      )}
      <p className="text-[15px] font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-3">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Failed request: what went wrong, and a retry. Uses the ApiError message from the server. */
export function ErrorState({ error, onRetry, title, className, compact = false }) {
  const offline = error?.code === "OFFLINE";
  const forbidden = error?.status === 403;
  const Icon = offline ? CloudOff : forbidden ? ShieldCheck : TriangleAlert;
  return (
    <div role="alert" className={cn("flex flex-col items-center text-center", compact ? "px-4 py-8" : "px-6 py-14", className)}>
      <div className={cn("mb-4 grid size-12 place-items-center rounded-tile", forbidden ? "bg-surface-2 text-ink-2" : "bg-bad-soft text-bad")}>
        <Icon className="size-6" aria-hidden />
      </div>
      <p className="text-[15px] font-semibold text-ink">
        {title || (offline ? "You're offline" : forbidden ? "Not available for your role" : "This didn't load")}
      </p>
      <p className="mt-1 max-w-sm text-sm text-ink-3">{error?.message || "Something went wrong."}</p>
      {onRetry && !forbidden && (
        <Button className="mt-5" variant="secondary" icon={RefreshCw} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/**
 * Standard query boundary: skeleton on first load, error with retry, then content.
 * While refetching, content stays on screen (slightly dimmed) instead of flashing a skeleton.
 */
export function QueryState({ query, skeleton, children, errorTitle, compact }) {
  if (query.isPending) return skeleton ?? <SkeletonList />;
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} title={errorTitle} compact={compact} />;
  return <div className={cn("transition-opacity duration-200", query.isFetching && query.isPlaceholderData && "opacity-60")}>{children(query.data)}</div>;
}
