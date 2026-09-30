/** Join class names, skipping falsy values. Components avoid conflicting utilities by design. */
export function cn(...parts) {
  return parts.flat(Infinity).filter(Boolean).join(" ");
}
