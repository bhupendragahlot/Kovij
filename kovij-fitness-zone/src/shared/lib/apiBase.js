/**
 * Where API calls go ("" = the same site that served the page).
 *
 * VITE_API_BASE_URL is for local development (e.g. http://localhost:4000). The tracked .env sets
 * it, and Vite bakes it into every build, so a live site such as kovij.onrender.com would call
 * the visitor's own computer. A localhost address is therefore only used when the page itself is
 * open on localhost; anywhere else the API is the site's own /api.
 */
const configured = String(import.meta.env.VITE_API_BASE_URL || "").trim().replace(/\/+$/, "");
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/i;

function resolve() {
  if (!configured) return "";
  let host = "";
  try {
    host = new URL(configured).hostname;
  } catch {
    return "";
  }
  const pageHost = typeof window !== "undefined" ? window.location.hostname : "";
  return LOCAL.test(host) && !LOCAL.test(pageHost) ? "" : configured;
}

export const API_ORIGIN = resolve();
