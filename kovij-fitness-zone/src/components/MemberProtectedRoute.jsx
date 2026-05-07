import { Navigate, Outlet } from "react-router-dom";
import { useMemberAuth } from "../context/MemberAuthContext";

export default function MemberProtectedRoute() {
  const { loading, member } = useMemberAuth();
  const token = localStorage.getItem("memberToken");

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-neutral-300">
        Loading…
      </div>
    );
  }

  if (!token || !member) {
    return <Navigate to="/member/login" replace />;
  }

  return <Outlet />;
}
