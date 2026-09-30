import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import MemberAuthPanel from "../../features/member-auth/MemberAuthPanel";

export default function MemberLogin() {
  const { member, loading } = useMemberAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (member) navigate("/member/dashboard", { replace: true });
  }, [member, navigate]);

  return (
    <div className="kv-container flex min-h-[70vh] flex-col items-center justify-center py-16">
      {loading ? (
        <p className="text-sm text-neutral-400">Checking your session…</p>
      ) : (
        <MemberAuthPanel title="Member sign in" subtitle="Sign in with your mobile number, email or Google account." />
      )}
    </div>
  );
}
