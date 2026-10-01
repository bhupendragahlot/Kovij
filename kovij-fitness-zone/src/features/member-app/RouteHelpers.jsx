import { Navigate, useLocation } from "react-router-dom";
import JoinGymForm from "../../pages/member/JoinGymForm";
import { useMemberAuth } from "../../context/MemberAuthContext";

/** "Join the gym" from the website: sign in or create an account, then pick a plan. */
export function JoinEntry() {
  const { member } = useMemberAuth();
  return member ? <Navigate to="/member/membership" replace /> : <JoinGymForm />;
}

/** Older links (emails, bookmarks) keep working. */
export function Redirect({ to }) {
  const { search } = useLocation();
  return <Navigate to={`${to}${to.includes("?") ? "" : search}`} replace />;
}
