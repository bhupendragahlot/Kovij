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
      // Two installable apps share this site and one service worker:
      //   app.webmanifest (generated here)  the member app, linked from the website and /member
      //   public/desk.webmanifest           the staff front desk, linked under /admin
      // src/app/appIdentity.js points <link rel="manifest"> at the right one for each page.
      // (public/manifest.webmanifest is an old hand-written file; nothing links it.)
      manifestFilename: "app.webmanifest",
      includeAssets: ["favicon.ico", "icons/apple-touch-icon.png", "icons/icon.svg", "desk.webmanifest"],
      manifest: {
        id: "/member/",
        name: "Kovij Fitness Zone",
        short_name: "Kovij",
        description: "Your Kovij Fitness Zone membership: check-in pass, workouts, diet, payments and gym updates.",
        start_url: "/member/home",
        scope: "/",
        display: "standalone",
        orientation: "any",
        background_color: "#131417",
        theme_color: "#131417",
        lang: "en-IN",
        categories: ["health", "fitness", "lifestyle"],
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
        shortcuts: [
          { name: "Check-in pass", short_name: "Pass", url: "/member/pass", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Workouts", short_name: "Workouts", url: "/member/workouts", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
          { name: "Payments", short_name: "Payments", url: "/member/payments", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
        ],
      },
      workbox: {
        // Push notification and notification-click handling (owned by the engagement module).
        importScripts: ["/push-handler.js"],
        globPatterns: ["**/*.{js,css,html,svg,png,woff2}"],
        // The brand kit's PNG exports are downloads for print and social media, not app assets (the SVG logos stay cached).
        globIgnores: ["brand/png/**", "brand/social/**", "brand/kovij-brand-sheet.png"],
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
            // Member app screens: fresh when online, the last copy when offline (an installed app
            // opens at the gym with no signal). Only this member's reads; cleared on sign-out
            // (MemberAuthContext) so the next person on a shared phone never sees them.
            urlPattern: ({ url, request }) =>
              request.method === "GET" &&
              url.origin === self.location.origin &&
              /^\/api\/(member\/(home|membership(\/(card|history|plans))?|attendance\/(streak|month|history)|workouts(\/logs)?|exercises\/(schedule|history)|diet|progress|notifications|announcements|trainer|payments(\/dues)?|support|auth\/(me|profile))|settings)$/.test(
                url.pathname
              ),
            handler: "NetworkFirst",
            options: {
              cacheName: "kv-member-api",
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 120, maxAgeSeconds: 7 * 24 * 60 * 60 },
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
