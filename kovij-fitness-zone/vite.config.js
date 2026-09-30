import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  server: {
    proxy: {
      "/api": { target: "http://localhost:4000/", secure: false },
      "/uploads": { target: "http://localhost:4000/", secure: false },
    },
    allowedHosts: ["kovij.onrender.com"],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      // public/manifest.webmanifest is the old hand-written file; this generated one replaces it.
      manifestFilename: "app.webmanifest",
      includeAssets: ["icons/apple-touch-icon.png", "icons/icon.svg"],
      manifest: {
        id: "/admin",
        name: "Kovij Front Desk",
        short_name: "Kovij Desk",
        description: "Check-ins, members, dues and renewals for Kovij Fitness Zone staff.",
        start_url: "/admin",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#eceef1",
        theme_color: "#131417",
        categories: ["business", "productivity", "health"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Check in a member", short_name: "Check-in", url: "/admin/check-in", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Register a member", short_name: "New member", url: "/admin/members/new", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Dues to collect", short_name: "Dues", url: "/admin/payments?status=pending", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        navigateFallback: "/index.html",
        navigateFallbackDenylist: [/^\/api\//, /^\/uploads\//],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Read-only staff lookups: fresh when online, last copy when offline. Cleared on sign-out.
            // Never cached: payments, receipts, ID proofs, anything that isn't a GET.
            // (Workbox serialises this function into the worker, so the pattern must be inline.)
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.origin === self.location.origin &&
              /^\/api\/(admin\/(dashboard|members(\/[a-f0-9]{24})?|attendance|trainers)|plans|auth\/me)$/.test(url.pathname),
            handler: "NetworkFirst",
            options: {
              cacheName: "kv-api",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 150, maxAgeSeconds: 24 * 60 * 60 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/uploads/avatars/"),
            handler: "CacheFirst",
            options: { cacheName: "kv-avatars", expiration: { maxEntries: 300, maxAgeSeconds: 30 * 24 * 60 * 60 } },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com" || url.origin === "https://fonts.gstatic.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "kv-fonts", expiration: { maxEntries: 20 } },
          },
        ],
      },
    }),
  ],
});
