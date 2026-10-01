import { useNavigate, useSearchParams } from "react-router-dom";
import { useEffect } from "react";
import { useMemberAuth } from "../../context/MemberAuthContext";
import MemberAuthPanel from "../../features/member-auth/MemberAuthPanel";

/** Only return to pages inside the member app. */
function safeNext(value) {
  return value && value.startsWith("/member/") && !value.startsWith("//") && !value.startsWith("/member/login") ? value : "/member/home";
}

export default function MemberLogin() {
  const { member, loading } = useMemberAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const expired = params.get("reason") === "expired";

  useEffect(() => {
    if (member) navigate(safeNext(params.get("next")), { replace: true });
  }, [member, navigate, params]);

  return (
    <div className="kv-container flex min-h-[70vh] flex-col items-center justify-center py-16">
      {loading ? (
        <p className="text-sm text-neutral-400">Checking your session…</p>
      ) : (
        <MemberAuthPanel
          title="Member sign in"
          subtitle={expired ? "Your session ended. Sign in again to continue." : "Sign in with your mobile number, email or Google account."}
        />
      )}
    </div>
  );
}
