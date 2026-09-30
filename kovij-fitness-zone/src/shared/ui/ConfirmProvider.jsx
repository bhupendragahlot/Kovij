import { useCallback, useRef, useState } from "react";
import { Dialog } from "./Dialog";
import { Button } from "./Button";
import { ConfirmContext } from "./confirmContext";

/** Hosts the single confirmation dialog used by `useConfirm()` (see confirmContext.js). */
export function ConfirmProvider({ children }) {
  const [request, setRequest] = useState(null);
  const resolver = useRef(null);
  const cancelRef = useRef(null);

  const confirm = useCallback(
    (options) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setRequest(options);
      }),
    []
  );

  const settle = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setRequest(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog
        open={Boolean(request)}
        onClose={() => settle(false)}
        title={request?.title}
        description={request?.body}
        size="sm"
        // Destructive confirms start on "Cancel" so a stray Enter does no harm.
        initialFocusRef={request?.tone === "danger" ? cancelRef : undefined}
        footer={
          <>
            <Button ref={cancelRef} variant="secondary" onClick={() => settle(false)}>
              {request?.cancelLabel || "Cancel"}
            </Button>
            <Button variant={request?.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
              {request?.confirmLabel || "Confirm"}
            </Button>
          </>
        }
      >
        {request?.content}
      </Dialog>
    </ConfirmContext.Provider>
  );
}
