/**
 * Which installable app a page belongs to. Members (and website visitors) install "Kovij Fitness
 * Zone", which opens on the member home; staff install "Kovij Front Desk" from any /admin page.
 * The browser reads <link rel="manifest"> to decide what "Install" installs, so it is pointed at
 * the right manifest at start-up and on every route change.
 */
const APPS = {
  member: { manifest: "/app.webmanifest", title: "Kovij" },
  desk: { manifest: "/desk.webmanifest", title: "Kovij Desk" },
};

export const appForPath = (pathname = "/") => (pathname === "/admin" || pathname.startsWith("/admin/") ? "desk" : "member");

const listeners = new Set();
/** Called when the page switches app (install offers for the previous app no longer apply). */
export const onAppChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

function headTag(selector, create) {
  let el = document.head.querySelector(selector);
  if (!el) {
    el = create();
    document.head.appendChild(el);
  }
  return el;
}

let current = null;

export function applyAppIdentity(pathname = window.location.pathname) {
  const key = appForPath(pathname);
  if (key === current) return;
  const app = APPS[key];
  const link = headTag('link[rel="manifest"]', () => Object.assign(document.createElement("link"), { rel: "manifest" }));
  if (link.getAttribute("href") !== app.manifest) link.setAttribute("href", app.manifest);
  // The name iPhones give the home-screen icon (Safari ignores the manifest name).
  headTag('meta[name="apple-mobile-web-app-title"]', () => Object.assign(document.createElement("meta"), { name: "apple-mobile-web-app-title" })).setAttribute(
    "content",
    app.title
  );
  const changed = current !== null;
  current = key;
  if (changed) listeners.forEach((fn) => fn(key));
}
