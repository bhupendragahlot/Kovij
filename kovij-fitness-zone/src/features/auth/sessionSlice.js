import { createSlice } from "@reduxjs/toolkit";
import { storage } from "../../shared/lib/storage";

const SESSION_KEY = "kv.staffSession";
const LEGACY_TOKEN_KEY = "token";

function loadSession() {
  if (typeof window === "undefined") return null;
  const saved = storage.get(SESSION_KEY);
  if (saved?.token && (!saved.expiresAt || Date.parse(saved.expiresAt) > Date.now())) return saved;
  // Tokens from the old admin panel carry no user; /auth/me will validate them.
  const legacy = storage.getRaw(LEGACY_TOKEN_KEY);
  return legacy ? { token: legacy, user: null, expiresAt: null } : null;
}

const saved = loadSession();

const sessionSlice = createSlice({
  name: "session",
  initialState: {
    token: saved?.token ?? null,
    user: saved?.user ?? null,
    expiresAt: saved?.expiresAt ?? null,
    /** signedOut | signedIn | expired */
    status: saved?.token ? "signedIn" : "signedOut",
  },
  reducers: {
    signedIn(state, { payload }) {
      state.token = payload.token;
      state.user = payload.user;
      state.expiresAt = payload.expiresAt ?? null;
      state.status = "signedIn";
    },
    userRefreshed(state, { payload }) {
      state.user = payload;
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      state.expiresAt = null;
      state.status = "signedOut";
    },
    /** Server rejected the token (401): keep nothing, but remember why for the login screen. */
    sessionExpired(state) {
      if (!state.token) return;
      state.token = null;
      state.user = null;
      state.expiresAt = null;
      state.status = "expired";
    },
  },
});

export const { signedIn, userRefreshed, signedOut, sessionExpired } = sessionSlice.actions;
export default sessionSlice.reducer;

export const selectSession = (s) => s.session;
export const selectToken = (s) => s.session.token;
export const selectStaffUser = (s) => s.session.user;
export const selectRole = (s) => s.session.user?.role ?? null;

export function persistSession(session) {
  storage.remove(LEGACY_TOKEN_KEY);
  if (session.token) storage.set(SESSION_KEY, { token: session.token, user: session.user, expiresAt: session.expiresAt });
  else storage.remove(SESSION_KEY);
}
