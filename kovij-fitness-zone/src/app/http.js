import { createApiClient } from "../shared/lib/apiClient";
import { store } from "./store";
import { sessionExpired, selectToken } from "../features/auth/sessionSlice";

/** Staff API client: attaches the staff session and ends it on 401. */
export const http = createApiClient({
  getToken: () => selectToken(store.getState()),
  onUnauthorized: () => store.dispatch(sessionExpired()),
});

/** Unwrap axios responses so feature code deals with data only. */
export const api = {
  get: (url, params) => http.get(url, { params }).then((r) => r.data),
  post: (url, body, { idempotencyKey } = {}) =>
    http.post(url, body, idempotencyKey ? { headers: { "Idempotency-Key": idempotencyKey } } : undefined).then((r) => r.data),
  patch: (url, body) => http.patch(url, body).then((r) => r.data),
  put: (url, body) => http.put(url, body).then((r) => r.data),
  delete: (url) => http.delete(url).then((r) => r.data),
  text: (url, params) => http.get(url, { params, responseType: "text" }).then((r) => r.data),
};
