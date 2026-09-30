import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { memberApi } from "../lib/memberApi";
import { signInWithGoogle, signOutFirebase } from "../features/member-auth/firebaseAuth";

const MemberAuthContext = createContext(null);

const base = import.meta.env.VITE_API_BASE_URL || "";

export function MemberAuthProvider({ children }) {
  const [member, setMember] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("memberToken");
    if (!token) {
      setMember(null);
      setLoading(false);
      return;
    }
    try {
      const { data } = await memberApi.get("/member/auth/me");
      setMember(data.member);
    } catch {
      localStorage.removeItem("memberToken");
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  /**
   * Trade a signed-in Firebase user (Google, email or phone) for a gym session.
   * `extra` answers the server's follow-up questions: `{ name }` for NEEDS_NAME,
   * `{ memberId }` for CHOOSE_MEMBER. Those come back as axios errors with `response.data.code`.
   */
  const exchangeSession = useCallback(async (firebaseUser, extra = {}) => {
    const idToken = await firebaseUser.getIdToken();
    const { data } = await axios.post(`${base}/api/member/auth/session`, { idToken, ...extra });
    if (!data?.token) throw new Error("No token from server");
    localStorage.setItem("memberToken", data.token);
    setMember(data.member);
    return data;
  }, []);

  const loginWithGoogle = useCallback(async () => {
    setError(null);
    const user = await signInWithGoogle();
    const data = await exchangeSession(user);
    return data.member;
  }, [exchangeSession]);

  const logout = useCallback(async () => {
    await signOutFirebase();
    localStorage.removeItem("memberToken");
    setMember(null);
  }, []);

  const value = useMemo(
    () => ({
      member,
      loading,
      error,
      setError,
      exchangeSession,
      loginWithGoogle,
      logout,
      refreshMember: loadMe,
    }),
    [member, loading, error, loadMe, exchangeSession, loginWithGoogle, logout]
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
