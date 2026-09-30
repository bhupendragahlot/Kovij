# Kovij platform: conventions and module ownership

Read this before changing code. Several modules are being built **at the same time in one working tree**. The rules below keep them from overwriting each other and keep the product consistent.

## 1. Ground rules for module builders

1. **Only edit files your module owns** (section 4) and new files you create inside your module's folders. If you need a change in a file you don't own, don't make it. List it under "Requests for other owners" in your final report.
2. **Shared foundation files are read-only for modules:**
   - `server/routes/index.js` (every mount point already exists: add endpoints inside *your* router files)
   - `server/config/permissions.js`, `kovij-fitness-zone/src/features/auth/permissionRules.js`
   - `server/services/notify.js`, `server/models/Notification.js`
   - `server/models/Member.js`, `server/models/Settings.js`, `server/middleware/*`, `server/utils/*`
   - `kovij-fitness-zone/src/App.jsx`, `src/layouts/crm/navigation.js`, `src/features/members/profileExtensions.js`, `src/features/settings/settingsExtensions.js`
   - `src/shared/ui/*` and `src/shared/ui/index.js` (existing components). You may add **new** component files under `src/shared/ui/` or `src/shared/`, and import them by direct path. Don't edit `index.js`.
   - `src/index.css` (design tokens), `vite.config.js`, both `package.json` files
3. **Never run `npm install`, `git commit`, `git push`, or delete files.** All needed libraries are installed (section 7). If you truly need another, say so in your report.
4. **Never start the server with the root `.env`**: it points at the live database and sends real emails. Test only with the e2e suite (section 6).
5. **Don't run `vite build`.** Several agents share `dist/`. Lint your own files instead: `cd kovij-fitness-zone && npx eslint src/features/<yours>`.
6. After every backend change run `node server/scripts/check-imports.mjs` (loads every route without a database). Write a new file completely before importing it; never leave a file half-written, because the server is shared with everyone else's tests.
7. Match the surrounding code: same idioms, comment density, naming. No TypeScript. ESM everywhere.

## 2. Backend conventions (`server/`)

- **Layering:** `routes/` (wiring: auth → permission → validate → idempotent → controller) → `controllers/` (thin, `asyncHandler`) → `services/` (business rules, transactions) → `models/`.
- **Auth:**
  - staff routes: `router.use(adminAuth)`, then `requirePermission('<name>')` per route (`middleware/requirePermission.js`, permission names in `config/permissions.js`)
  - member routes: `router.use(memberAuth)`, then `req.member.memberId`
  - Every staff route must check a permission, and trainers must never reach money (`payments.*`, `revenue.view`, `expenses.manage`).
- **Validation:** zod schemas in `validators/<module>.schema.js`; `validate(schema, 'body'|'query'|'params')` puts the parsed value on `req.validated.<source>`. Invalid input gives 422 with `details.fields` keyed by path (e.g. `details.phone`), which the UI maps onto fields.
- **Errors:** `throw new AppError(message, status, CODE, details?)`. Messages are shown to users: plain, specific, and they say what to do. Mongo cast errors map to 404 and duplicates to 409 automatically.
- **Responses:** `{ success: true, ...data }`. Lists: `{ success, items|<plural>, total, page, limit }`.
- **Money-moving or duplicate-sensitive POSTs** (payments, sales, registrations, online orders): add `idempotent()` after validation and give the model a unique `idempotencyKey` backstop. See `middleware/idempotency.js` and `services/paymentService.js`.
- **Transactions:** `withTransaction(async (session) => …)` from `utils/db.js` (MongoDB replica set) for multi-document writes.
- **Time:** always gym time (Asia/Kolkata) via `utils/time.js` (`gymDayKey`, `toGymTime`, `startOfGymDay`, …). Never compare dates as strings; never use server-local midnight.
- **Emails:** `queueEmail({ to, templateKey, vars })`. Add templates in your own file with `registerTemplates({...})` and `wrapEmail()` from `services/emailTemplates/index.js`, then import that file from your service so it registers at load. Escape every interpolated value with `escapeHtml` (`utils/strings.js`).
- **Telling a member something:** use `notifyMember()` from `services/notify.js`. Never email members directly. It records an in-app notification, respects preferences, sends email, and fans out to extra channels (push) registered with `registerChannel()`. For automated sends always pass a `dedupeKey`, e.g. `expiry:<membershipId>:7d`.
- **Uploads:** private by default (ID proofs, progress photos). Stream them through an authenticated route; never `express.static` them. Public avatars only go in `uploads/avatars`. See `services/storageService.js`.
- **Phones:** stored canonical 10 digits (`canonicalPhone`). Search with `normalizePhone`.
- **Settings:** read with `getSettingsDoc()`. `PATCH /api/admin/settings` merges the nested groups `payments` and `reminders` field by field.
- **Scheduled jobs:** `node-cron` with `{ timezone: GYM_TZ }`, registered from `cron/cronRunner.js` (owned by the reminders module). Each job exports a `run…Job(now)` function so tests can call it directly. Jobs must be idempotent: overlapping runs and restarts must not double-send.

## 3. Frontend conventions (`kovij-fitness-zone/src/`)

- **Structure:** `features/<module>/` holds `api.js` (TanStack Query hooks), pages, and components. Server state goes through **TanStack Query only**; client-only state (theme, session, toasts) is in Redux (`app/`). Don't add Redux slices for server data.
- **API:** `import { api } from "../../app/http"` (staff token attached; `api.get(url, params)`, `api.post(url, body, { idempotencyKey })`, `api.patch`, `api.delete`). Query keys: define them in your own `api.js` as `["<module>", …]` arrays. Invalidate what a mutation changes (and `["dashboard"]` if it affects today's numbers).
- **Idempotent writes:** `useIdempotencyKey()` (`shared/hooks/useIdempotencyKey.js`): `idempotency.keyFor(payload)` on submit, `idempotency.reset()` on success. Mutations retry with `retryIdempotent` from `app/queryClient.js`.
- **Permissions:** `usePermission("expenses.manage")` or `<Can action="…">`. Hide what a role can't do, and always keep the server check too.
- **Design system:** use `shared/ui`:
  - `Button`, `ButtonLink`, `IconButton`
  - `Card`, `CardHeader`, `Tile`
  - `Badge`, `StatusBadge`
  - `Field`, `Input`, `Textarea`, `Select`, `Switch`, `SegmentedControl`, `TagInput`
  - `Dialog` (`placement="side"` for drawers; bottom sheet on phones), `useConfirm`, `Menu`, `Avatar`
  - `Skeleton`, `SkeletonList`, `EmptyState`, `ErrorState`
  - `DataTable` (table on desktop, `mobileRow` card list on phones)
  - `PageHeader`, `SearchInput`, `FilterChips`, `Tabs`, `TabPanel`, `Pagination`
  - `KpiTile`, `Meter`, `InlineAlert`, `FormError`, `useToast`
  - Charts: `shared/ui/charts/` (Recharts; follow `charts.jsx`: thin marks, 4px rounded bar tops, hairline grid, legend when there are ≥ 2 series, and a table view).
- **Tokens only:** colours through utilities like `bg-surface text-ink border-line bg-brand text-on-brand text-good bg-warn-soft`. **No raw hex, no `theme === "dark"` branches**; dark mode comes from tokens. Radii: `rounded-hero` / `rounded-card` / `rounded-tile` / `rounded-control`.
- **Every screen has all its states:** loading (skeleton shaped like the content), empty (says what to do, with an action), error (message plus retry), offline for writes (`useOnlineStatus`), permission-hidden controls, and a success toast named with the same verb as the button ("Save plan" gives "Plan saved").
- **Phones first:**
  - Lists use `DataTable` with a `mobileRow`.
  - Forms are one column on phones; controls are at least 44px tall.
  - Dialogs become bottom sheets.
  - No horizontal page scroll at 360px. Grids use `grid-cols-1` before breakpoints.
- **Copy:** sentence case, no ALL CAPS labels, verbs on buttons, errors say what to do next, and no jargon (not "entity", "record", "sync", or "AI").
- **Accessibility:**
  - real `button`/`a`/`label`; icon-only buttons need `label`
  - form errors come through `Field` (it wires `aria-describedby`)
  - status is never colour-only (icon + word)
  - respect `prefers-reduced-motion`
- **Dates and money:** `formatDate`, `formatShortDate`, `formatRelativeDay`, `formatINR`, `formatPhone`, `gymDayKey` from `shared/lib/format.js`. Plain JS; no date libraries in the frontend.

## 4. Module ownership (phase 1)

Each module owns its **backend** (models, services, controllers, validators, route files, email templates, unit tests), its **staff UI**, its **member-facing API** (`/api/member/...`, used by the member app in phase 2), and an **e2e flow file** `server/tests/e2e/flows/<module>.mjs`.

| Module | Owns (existing) | Owns (new; placeholders already exist where listed) |
|---|---|---|
| **members** (members & membership lifecycle) | `models/Membership.js`, `models/PlanHistory.js`, `models/Plan.js`, `models/MemberProfile.js`, `services/memberService.js`, `services/membershipService.js`, `services/salesService.js`, `controllers/adminMemberController.js`, `controllers/membershipController.js`, `controllers/memberProfileController.js`, `controllers/planController.js`, `routes/adminMemberRoutes.js`, `routes/membershipRoutes.js` (legacy), `routes/planRoutes.js`, `validators/member.schema.js`, `validators/membership.schema.js`, `validators/catalog.schema.js` (plan part); UI `features/members/*` (except `profileExtensions.js`), `features/catalog/PlansPage.jsx` | `routes/admin/membershipOpsRoutes.js` (/api/admin/memberships), `routes/member/membershipRoutes.js` (/api/member/membership); UI `features/renewals/RenewalsPage.jsx` |
| **payments** (payments, online payments, finance & expenses) | `models/Payment.js`, `services/paymentService.js`, `services/receiptService.js`, `controllers/adminPaymentController.js`, `controllers/paymentController.js`, `routes/adminPaymentRoutes.js`, `routes/paymentRoutes.js` (legacy), `validators/payment.schema.js`; UI `features/payments/*` | `routes/admin/expenseRoutes.js`, `routes/admin/financeRoutes.js`, `routes/member/paymentRoutes.js`, `routes/webhookRoutes.js`; UI `features/expenses/*`, `features/finance/*`, `features/payments/PaymentSettings.jsx` |
| **attendance** (attendance & QR) | `models/Attendance.js`, `controllers/attendanceController.js`, `validators/attendance.schema.js`; UI `features/attendance/*` | `routes/admin/attendanceRoutes.js`, `routes/member/attendanceRoutes.js`; UI `AttendancePage.jsx`, `KioskPage.jsx`, `MemberAttendanceTab.jsx` |
| **training** (trainers, workouts & exercise library) | `models/Trainer.js`, `controllers/trainerController.js`, `controllers/crudFactory.js`, `routes/trainerRoutes.js` (public), `validators/trainer.schema.js`; UI `features/catalog/TrainersPage.jsx` | `routes/admin/trainerRoutes.js`, `routes/admin/workoutRoutes.js`, `routes/admin/exerciseRoutes.js`, `routes/member/workoutRoutes.js`, `routes/member/trainerRoutes.js`; UI `features/workouts/*` |
| **wellness** (diet, progress & notes) | `models/BodyMeasurement.js` | `routes/admin/dietRoutes.js`, `routes/admin/progressRoutes.js`, `routes/admin/memberNoteRoutes.js`, `routes/member/dietRoutes.js`, `routes/member/progressRoutes.js`; UI `features/diet/*`, `features/progress/*`, `features/notes/*` |
| **engagement** (reminders, notifications & announcements) | `cron/*`, `services/emailService.js`, `services/emailTemplates/index.js` (existing templates only; don't change `registerTemplates`), `models/EmailLog.js` | `routes/admin/reminderRoutes.js`, `routes/admin/announcementRoutes.js`, `routes/admin/notificationRoutes.js`, `routes/member/notificationRoutes.js`, `routes/member/announcementRoutes.js`; UI `features/reminders/*`, `features/announcements/*`, `features/communication/*`, `features/notifications/*` |
| **security** (staff, security, activity & gym settings) | `models/User.js`, `controllers/authController.js`, `controllers/staffController.js`, `controllers/settingsController.js`, `routes/authRoutes.js`, `routes/settingsRoutes.js` (public), `validators/staff.schema.js`, `validators/settings.schema.js`, `services/tokenService.js` (staff tokens only); UI `features/auth/*` (except `permissionRules.js`), `features/settings/*` (except `settingsExtensions.js`), `layouts/crm/Topbar.jsx` | `routes/admin/settingsRoutes.js`, `routes/admin/staffRoutes.js`, `routes/admin/activityRoutes.js`; UI `features/activity/*`, `features/settings/GymProfileSettings.jsx`, `ForgotPasswordPage.jsx`, `ResetPasswordPage.jsx` |

**Phase 2** (after phase 1 is merged): **reports** (reports & dashboard: `routes/admin/reportRoutes.js`, `routes/admin/dashboardRoutes.js`, `services/dashboardService.js`, `features/reports/*`, `features/dashboard/*`), **member-core** (member app shell, home, pass, profile, settings; sign-in is already built, see below), **member-content** (member app pages, support inbox).

**Member sign-in (built, reuse it):** mobile number + SMS code, email + password (with email verification and reset), and Google all go through Firebase, then `POST /api/member/auth/session` swaps the Firebase token for a member session (`/google` is kept as an alias). The linking rules (which member a sign-in belongs to, shared family phone numbers, unverified emails) are in `server/services/memberIdentity.js` with unit tests; the UI is `src/features/member-auth/MemberAuthPanel.jsx`, and `useMemberAuth().exchangeSession` is the client call.

## 5. Shared extension points (already wired)

- **Member profile tabs:**
  - `features/attendance/MemberAttendanceTab.jsx`, `features/workouts/MemberWorkoutTab.jsx`, `features/diet/MemberDietTab.jsx`, `features/progress/MemberProgressTab.jsx`, `features/notes/MemberNotesTab.jsx`
  - Each receives `{ member, profile, memberships, payments, attendance }`.
- **Member profile header action:** `features/communication/MemberMessageAction.jsx`, receives `{ member }`.
- **Settings sections:**
  - `features/settings/GymProfileSettings.jsx` (security module)
  - `features/payments/PaymentSettings.jsx` (payments module)
  - `features/reminders/ReminderSettings.jsx` (engagement module)
  - Each receives `{ settings, readOnly }`.
- **Staff pages already routed:**
  - `/admin/renewals`, `/admin/attendance`, `/admin/kiosk` (full-screen), `/admin/revenue`, `/admin/expenses`
  - `/admin/workouts`, `/admin/workouts/:id`, `/admin/exercises`, `/admin/diets`, `/admin/diets/:id`
  - `/admin/announcements`, `/admin/activity`, `/admin/forgot-password`, `/admin/reset-password`
  - Phase 2: `/admin/reports`, `/admin/support`
- **API mounts:** `server/routes/index.js` (read it for the exact paths). Routers under `/admin/members/:memberId/…` use `express.Router({ mergeParams: true })`.
- **New member fields:** `joinedAt`, `referral { channel, referredByMemberId, referredByName }`, `assignedTrainerId`, `notificationPrefs { email, push, announcements, birthday, workoutUpdates }`.
- **Activity log hook:** `server/middleware/activityLog.js` runs on every `/api` request (owned by the security module; read `req.staffUser` in `res.on('finish')`).
- **Session revocation:** `User.passwordChangedAt`. `adminAuth` rejects tokens issued before it. The security module sets it whenever a password changes.
- **Service worker push:** `kovij-fitness-zone/public/push-handler.js` is imported into the service worker (owned by the engagement module).
- **New settings fields:** `logoUrl`, `openingHours[{ day, closed, slots[{open, close}] }]`, `holidays[{ date, name }]`, `payments { upiId, payeeName, onlineEnabled, acceptCash, acceptUpi, acceptCard, allowPartial }`, `reminders { enabled, expiryDaysBefore[], onExpiryDay, afterExpiryDays[], paymentDue, paymentDueEveryDays, birthday, sendHour }`.

## 6. Testing

- Unit tests: `server/tests/<module>.test.js` with `node:test`. Run all with `npm test` (from the repo root).
- E2E: write `server/tests/e2e/flows/<module>.mjs` using `server/tests/e2e/lib.mjs` (`call`, `check`, `adminToken`, `staffToken(role)`, `memberToken(id)`, `createMember`, `createPlan`, `uniq`, `uniqPhone`, `key`, `finish`). Flows share one database: create your own data and never assume counts start at zero.
- Run **only your flow, on your own port** (other agents are running theirs):
  `E2E_ONLY=<module> E2E_PORT=<your port> npm run test:e2e` from the repo root.
  The runner starts an in-memory MongoDB, a test server with no `.env`, no emails, no crons, a TypeSafe stub, and rate limits off.
- Test money paths, permissions (a trainer and a front-desk account must get 403 where they should), and idempotency.
- For scheduled jobs, export and call `run…Job(now)` directly from a unit test or a test-only endpoint guarded by `NODE_ENV === 'test'`.

## 7. Installed libraries

- **Backend:** express 4, mongoose 8, zod 3, dayjs (+utc/timezone), node-cron, nodemailer (queue in `emailService.js`), multer, p-queue, `web-push` (VAPID), jsonwebtoken, bcryptjs.
- **Frontend:** React 19, react-router 7 (data router), @tanstack/react-query 5, @reduxjs/toolkit, recharts 3, lucide-react, `qrcode` (generate QR), `jsqr` (decode QR from camera frames; use the browser `BarcodeDetector` first when available).
- No gateway SDK: talk to payment gateways with `fetch` plus `crypto` HMAC verification.
