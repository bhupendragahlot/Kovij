import { useState } from "react";
import { useMemberAuth } from "../../context/MemberAuthContext";

export default function GoogleSignInButton({ className = "" }) {
  const { loginWithGoogle, setError } = useMemberAuth();
  const [busy, setBusy] = useState(false);

  const onClick = async () => {
    setBusy(true);
    try {
      await loginWithGoogle();
    } catch (e) {
      setError(e?.response?.data?.message || e.message || "Sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className={`rounded-lg border border-neutral-700 bg-white px-4 py-3 text-sm font-semibold text-neutral-900 shadow hover:bg-neutral-100 disabled:opacity-60 ${className}`}
    >
      {busy ? "Signing in…" : "Continue with Google"}
    </button>
  );
}
