import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { memberApi } from "../lib/memberApi";
import { signInWithGoogle, signOutFirebase } from "../features/member-auth/firebaseAuth";
import { MEMBER_SESSION_EXPIRED } from "../features/member-app/http";

const MemberAuthContext = createContext(null);

const base = import.meta.env.VITE_API_BASE_URL || "";
const SAVED_MEMBER_KEY = "kv.member";

function saveMember(member) {
  try {
    localStorage.setItem(SAVED_MEMBER_KEY, JSON.stringify(member));
  } catch {
    /* storage blocked: nothing to cache */
  }
}

function readSavedMember() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_MEMBER_KEY) || "null");
  } catch {
    return null;
  }
}

function clearSession() {
  try {
    localStorage.removeItem("memberToken");
    localStorage.removeItem(SAVED_MEMBER_KEY);
  } catch {
    /* ignore */
  }
}

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
      saveMember(data.member);
    } catch (err) {
      const status = err?.response?.status;
      if (status === 401 || status === 403 || status === 404) {
        // The session really is over.
        clearSession();
        setMember(null);
      } else {
        // Offline or the server is unreachable: stay signed in with what we knew, so the
        // check-in pass and cached screens still work at the gym door.
        setMember(readSavedMember());
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  // Any member request that comes back 401 ends the session (features/member-app/http.js).
  useEffect(() => {
    const onExpired = () => {
      clearSession();
      setMember(null);
    };
    window.addEventListener(MEMBER_SESSION_EXPIRED, onExpired);
    return () => window.removeEventListener(MEMBER_SESSION_EXPIRED, onExpired);
  }, []);

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
    saveMember(data.member);
    return data;
  }, []);

  /** Test-mode mobile sign-in (server has DEFAULT_OTP): phone number + the fixed code, no SMS. */
  const otpSignIn = useCallback(async ({ phone, code, name, memberId }) => {
    const { data } = await axios.post(`${base}/api/member/auth/otp/verify`, { phone, code, name, memberId });
    if (!data?.token) throw new Error("No token from server");
    localStorage.setItem("memberToken", data.token);
    setMember(data.member);
    saveMember(data.member);
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
    clearSession();
    setMember(null);
  }, []);

  const value = useMemo(
    () => ({
      member,
      loading,
      error,
      setError,
      exchangeSession,
      otpSignIn,
      loginWithGoogle,
      logout,
      refreshMember: loadMe,
    }),
    [member, loading, error, loadMe, exchangeSession, otpSignIn, loginWithGoogle, logout]
  );

  return <MemberAuthContext.Provider value={value}>{children}</MemberAuthContext.Provider>;
}

export function useMemberAuth() {
  const ctx = useContext(MemberAuthContext);
  if (!ctx) throw new Error("useMemberAuth must be used within MemberAuthProvider");
  return ctx;
}
