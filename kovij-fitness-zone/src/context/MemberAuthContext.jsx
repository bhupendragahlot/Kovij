import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { memberApi } from "../lib/memberApi";

/** Firebase (~300 KB) is only needed at the moment of Google sign-in/out, so load it on demand. */
const loadFirebase = () => Promise.all([import("firebase/auth"), import("../firebase/firebase")]);

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

  const loginWithGoogle = async () => {
    setError(null);
    const [{ signInWithPopup }, { auth, googleProvider }] = await loadFirebase();
    const cred = await signInWithPopup(auth, googleProvider);
    const idToken = await cred.user.getIdToken();
    const { data } = await axios.post(`${base}/api/member/auth/google`, { idToken });
    if (!data?.token) throw new Error("No token from server");
    localStorage.setItem("memberToken", data.token);
    setMember(data.member);
    return data.member;
  };

  const logout = async () => {
    try {
      const [{ signOut }, { auth }] = await loadFirebase();
      await signOut(auth);
    } catch {
      /* ignore */
    }
    localStorage.removeItem("memberToken");
    setMember(null);
  };

  const value = useMemo(
    () => ({
      member,
      loading,
      error,
      setError,
      loginWithGoogle,
      logout,
      refreshMember: loadMe,
    }),
    [member, loading, error, loadMe]
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
