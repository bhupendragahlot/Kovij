import { QueryClient } from "@tanstack/react-query";

const isClientError = (err) => err?.status >= 400 && err?.status < 500;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 10 * 60_000,
      // 4xx won't fix itself; retry only network and server failures. Offline, fail at once
      // (the screen says "You're offline") instead of pausing on a skeleton until the signal is
      // back; refetchOnReconnect loads it again then.
      retry: (count, err) => count < 2 && !isClientError(err) && err?.code !== "OFFLINE",
      refetchOnWindowFocus: true,
      // Try the network (the service worker may answer from cache) even when offline.
      networkMode: "offlineFirst",
    },
    mutations: {
      // Writes wait for a connection instead of failing; see useSafeMutation for retry rules.
      networkMode: "online",
      retry: 0,
    },
  },
});

/**
 * Retry policy for idempotent writes (payments, registrations, check-ins): the server
 * dedupes by Idempotency-Key, so retrying a lost or in-flight request is safe.
 */
export const retryIdempotent = (count, err) =>
  count < 3 && (err?.isNetwork || err?.code === "IDEMPOTENCY_IN_PROGRESS" || err?.status >= 500);

export const retryDelay = (attempt) => Math.min(1000 * 2 ** attempt, 8000);
