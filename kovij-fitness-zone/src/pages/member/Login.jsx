import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import GoogleSignInButton from "../../components/member/GoogleSignInButton";
import { useMemberAuth } from "../../context/MemberAuthContext";
import { memberApi } from "../../lib/memberApi";

export default function MemberLogin() {
  const { member, error, setError } = useMemberAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (member) navigate("/member/dashboard", { replace: true });
  }, [member, navigate]);

  return (
    <div className="kv-container flex min-h-[70vh] flex-col items-center justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-neutral-800 bg-neutral-950/80 p-8 shadow-xl">
        <h1 className="mb-2 text-center font-['Lexend'] text-2xl font-black uppercase text-white">
          Member sign in
        </h1>
        <p className="mb-6 text-center text-sm text-neutral-400">
          Use your Google account. After sign-in you can complete gym membership.
        </p>
        {error && <p className="mb-4 rounded bg-red-900/40 px-3 py-2 text-center text-sm text-red-200">{error}</p>}
        <div className="flex justify-center">
          <GoogleSignInButton />
        </div>
        <button
          type="button"
          className="mt-6 w-full text-center text-sm text-neutral-500 hover:text-white"
          onClick={() => setError(null)}
        >
          Clear message
        </button>
        <p className="mt-8 text-center text-xs text-neutral-600">
          <Link to="/" className="text-red-500 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
