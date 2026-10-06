import { CloudOff } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

/** Persistent, polite notice while offline. Explains what still works (`children` replaces the staff wording). */
export function OfflineBanner({ children }) {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="flex items-center gap-2.5 border-b border-warn/30 bg-warn-soft px-4 py-2 text-body-sm text-warn sm:px-6">
      <CloudOff className="size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-bold">You&apos;re offline.</span>{" "}
        {children || "You can look up members and today's check-ins from the last sync. Payments and edits resume when you reconnect."}
      </p>
    </div>
  );
}
