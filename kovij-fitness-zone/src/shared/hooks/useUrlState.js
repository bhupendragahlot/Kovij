import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

/**
 * List filters stored in the URL (?state=active&q=raj&page=2), so they survive reloads,
 * can be shared, and the back button restores them. Defaults are omitted from the URL.
 */
export function useUrlState(defaults) {
  const [params, setParams] = useSearchParams();

  const state = useMemo(() => {
    const out = { ...defaults };
    for (const key of Object.keys(defaults)) {
      const raw = params.get(key);
      if (raw == null) continue;
      out[key] = typeof defaults[key] === "number" ? Number(raw) || defaults[key] : raw;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);

  const update = useCallback(
    (patch) => {
      setParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          // Changing any filter returns to page 1 unless the page itself was set.
          if (!("page" in patch) && "page" in defaults) next.delete("page");
          for (const [k, v] of Object.entries(patch)) {
            if (v === "" || v == null || String(v) === String(defaults[k])) next.delete(k);
            else next.set(k, String(v));
          }
          return next;
        },
        { replace: true }
      );
    },
    [setParams, defaults]
  );

  return [state, update];
}
