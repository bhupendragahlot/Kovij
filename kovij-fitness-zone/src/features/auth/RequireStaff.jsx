import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectSession } from "./sessionSlice";
import { useStaffSession } from "./api";
import { Skeleton } from "../../shared/ui";

/**
 * Gate for the staff app. A stored token is not trusted on its own: /auth/me confirms it,
 * and any 401 later in the session ends it (see app/http.js).
 */
export function RequireStaff({ children }) {
  const session = useSelector(selectSession);
  const location = useLocation();
  const me = useStaffSession();

  if (!session.token) {
    const next = encodeURIComponent(location.pathname + location.search);
    const reason = session.status === "expired" ? "&reason=expired" : "";
    return <Navigate to={`/admin/login?next=${next}${reason}`} replace />;
  }

  // First visit with a legacy token: wait for the user profile before rendering role-aware UI.
  if (!session.user && me.isPending) {
    return (
      <div className="kv-app grid min-h-dvh place-items-center bg-canvas font-ui" role="status" aria-label="Checking your session">
        <Skeleton className="h-2 w-40 rounded-full" />
      </div>
    );
  }

  return children;
}
