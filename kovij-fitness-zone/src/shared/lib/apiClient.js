import axios from "axios";
import { API_ORIGIN } from "./apiBase";

const API_BASE = `${API_ORIGIN}/api`;

/** Normalised error every feature can branch on (`code`) and show (`message`). */
export class ApiError extends Error {
  constructor({ status, code, message, details }) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Per-field validation messages from the server, keyed by field path. */
  get fields() {
    return this.details?.fields || {};
  }

  get isNetwork() {
    return this.status === 0;
  }
}

export function toApiError(err) {
  if (err instanceof ApiError) return err;
  const res = err?.response;
  if (!res) {
    const offline = typeof navigator !== "undefined" && navigator.onLine === false;
    return new ApiError({
      status: 0,
      code: offline ? "OFFLINE" : "NETWORK_ERROR",
      message: offline
        ? "You're offline. This will work again when the connection is back."
        : "Couldn't reach the server. Check the connection and try again.",
    });
  }
  const body = typeof res.data === "object" && res.data ? res.data : {};
  return new ApiError({
    status: res.status,
    code: body.code || `HTTP_${res.status}`,
    message: body.message || "Something went wrong. Try again.",
    details: body.details,
  });
}

/**
 * Create an axios instance that attaches a bearer token and converts failures to ApiError.
 * @param {{ getToken: () => string|null, onUnauthorized?: (e: ApiError) => void }} opts
 */
export function createApiClient({ getToken, onUnauthorized }) {
  const client = axios.create({ baseURL: API_BASE, timeout: 20_000 });
  client.interceptors.request.use((config) => {
    const token = getToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  });
  client.interceptors.response.use(
    (res) => res,
    (err) => {
      const apiErr = toApiError(err);
      if (apiErr.status === 401) onUnauthorized?.(apiErr);
      return Promise.reject(apiErr);
    }
  );
  return client;
}

/** 32 hex chars; unique per logical operation (one payment, one registration). */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID().replace(/-/g, "");
  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
