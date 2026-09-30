import { useCallback, useRef } from "react";
import { newIdempotencyKey } from "../lib/apiClient";
import { stableStringify } from "../lib/format";

/**
 * One Idempotency-Key per logical operation.
 *
 * The same payload gets the same key, so a retry (double tap, timeout, reconnect) is
 * recognised by the server as a repeat and never charges twice. Editing the form changes
 * the payload and so produces a fresh key. Call `reset()` after success so the next
 * payment, even with identical values, is treated as new.
 */
export function useIdempotencyKey() {
  const ref = useRef({ payload: null, key: null });

  const keyFor = useCallback((payload) => {
    const serialized = stableStringify(payload);
    if (ref.current.payload !== serialized) {
      ref.current = { payload: serialized, key: newIdempotencyKey() };
    }
    return ref.current.key;
  }, []);

  const reset = useCallback(() => {
    ref.current = { payload: null, key: null };
  }, []);

  return { keyFor, reset };
}
