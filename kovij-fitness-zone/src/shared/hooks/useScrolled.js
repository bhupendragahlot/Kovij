import { useEffect, useState } from "react";

/**
 * True once the page has scrolled past `threshold` px. Top app bars use it to lift (tint and
 * hairline) only when content is underneath them, as Material top app bars do.
 */
export function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = useState(() => typeof window !== "undefined" && window.scrollY > threshold);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}
