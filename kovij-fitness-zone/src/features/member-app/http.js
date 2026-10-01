import { createApiClient } from "../../shared/lib/apiClient";

export const MEMBER_TOKEN_KEY = "memberToken";
/** Fired when the member's session is rejected; MemberAuthContext signs out. */
export const MEMBER_SESSION_EXPIRED = "kv:member-session-expired";

/** Member API client: the member session, errors as ApiError, sign-out on 401. */
export const memberHttp = createApiClient({
  getToken: () => {
    try {
      return localStorage.getItem(MEMBER_TOKEN_KEY);
    } catch {
      return null;
    }
  },
  onUnauthorized: () => window.dispatchEvent(new Event(MEMBER_SESSION_EXPIRED)),
});

export const mapi = {
  get: (url, params) => memberHttp.get(url, { params }).then((r) => r.data),
  post: (url, body, { idempotencyKey } = {}) =>
    memberHttp.post(url, body, idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined).then((r) => r.data),
  put: (url, body) => memberHttp.put(url, body).then((r) => r.data),
  patch: (url, body) => memberHttp.patch(url, body).then((r) => r.data),
  delete: (url) => memberHttp.delete(url).then((r) => r.data),
  text: (url) => memberHttp.get(url, { responseType: "text" }).then((r) => r.data),
};
