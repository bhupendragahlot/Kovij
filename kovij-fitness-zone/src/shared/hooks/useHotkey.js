import { useEffect, useRef } from "react";

const isTyping = (el) => el && (el.isContentEditable || /^(input|textarea|select)$/i.test(el.tagName));

/**
 * Global keyboard shortcut. `combo` examples: "mod+k" (Ctrl on Windows, Cmd on Mac), "/", "n".
 * Single-key shortcuts are ignored while the user is typing in a field.
 */
export function useHotkey(combo, handler, { enabled = true } = {}) {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  useEffect(() => {
    if (!enabled) return undefined;
    const parts = combo.toLowerCase().split("+");
    const key = parts.pop();
    const needsMod = parts.includes("mod");

    const onKeyDown = (e) => {
      if (e.key?.toLowerCase() !== key) return;
      const mod = e.metaKey || e.ctrlKey;
      if (needsMod !== mod) return;
      if (!needsMod && (isTyping(e.target) || e.altKey)) return;
      e.preventDefault();
      handlerRef.current(e);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [combo, enabled]);
}
