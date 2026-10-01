import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useDispatch, useSelector } from "react-redux";
import { api } from "../../app/http";
import { selectToken, signedIn, signedOut, userRefreshed } from "./sessionSlice";

export const authKeys = { me: ["auth", "me"], signIns: ["auth", "sign-ins"] };

export function useLogin() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials) => api.post("/auth/login", credentials),
    onSuccess: (data) => {
      queryClient.clear();
      dispatch(signedIn({ token: data.token, user: data.user, expiresAt: data.expiresAt }));
    },
  });
}

/** Validates the stored session with the server and keeps role/name fresh. */
export function useStaffSession() {
  const dispatch = useDispatch();
  const token = useSelector(selectToken);
  return useQuery({
    // The cache is cleared on every sign-in/out, so the key doesn't need the token.
    queryKey: authKeys.me,
    queryFn: async () => {
      const data = await api.get("/auth/me");
      dispatch(userRefreshed(data.user));
      return data.user;
    },
    enabled: Boolean(token),
    staleTime: 5 * 60_000,
    retry: (count, err) => count < 2 && err?.isNetwork,
  });
}

export function useLogout() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  return () => {
    dispatch(signedOut());
    queryClient.clear();
    // Drop cached staff data from the service worker so the next person at this desk can't see it.
    if (typeof caches !== "undefined") caches.delete("kv-api").catch(() => {});
  };
}

/** "Forgot password": always answers the same, whether or not the email has an account. */
export function useForgotPassword() {
  return useMutation({ mutationFn: (email) => api.post("/auth/forgot-password", { email }) });
}

/** Checks a reset link before the form is shown, so an expired link says so straight away. */
export function useResetLink(token) {
  return useQuery({
    queryKey: ["auth", "reset-link", token],
    queryFn: () => api.get("/auth/reset-password", { token }),
    enabled: Boolean(token),
    retry: false,
    staleTime: Infinity,
  });
}

export function useResetPassword() {
  return useMutation({ mutationFn: ({ token, password }) => api.post("/auth/reset-password", { token, password }) });
}

/** Change my password: this device gets a fresh session, other devices are signed out. */
export function useChangePassword() {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload) => api.post("/auth/change-password", payload),
    onSuccess: (data) => {
      dispatch(signedIn({ token: data.token, user: data.user, expiresAt: data.expiresAt }));
      queryClient.invalidateQueries({ queryKey: authKeys.signIns });
    },
  });
}

export function useMySignIns() {
  return useQuery({ queryKey: authKeys.signIns, queryFn: () => api.get("/auth/sign-ins"), select: (d) => d.items });
}
