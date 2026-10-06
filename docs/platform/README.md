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

**Phase 2 (built):**

- **Reports & dashboard:** `services/reportService.js` (period maths and renewal rules are pure and unit-tested), `controllers/reportController.js`, `routes/admin/reportRoutes.js` (`reports.view`): `GET /overview?from&to&days`, `GET /not-coming-in`, `GET /renewals.csv`, `GET /not-coming-in.csv`. UI `features/reports/*`. The dashboard (`services/dashboardService.js`) counts frozen members separately, never sends dues to roles without `payments.view`, leaves already-renewed members out of "ending soon", and shows unread member questions to `support.manage` roles.
- **Support:** `models/SupportTicket.js`, `services/supportService.js`, `routes/member/supportRoutes.js` (members), `routes/admin/supportRoutes.js` (`support.manage`). A desk reply notifies the member (in-app + email template `supportReply`). UI: staff `features/support/*`, member `features/member-app/pages/SupportPages.jsx`.
- **Member app:** `features/member-app/*` (routes in `routes.jsx`, shell `MemberAppLayout.jsx`, data in `queries.js` over `http.js`, which signs the member out on a 401). Home extras come from `GET /api/member/home` (`services/memberHomeService.js`: week strip, typical crowd now, latest weight, unread count); everything else reuses the module endpoints. The check-in pass is saved on the phone (`kv.memberPass`) so it works offline; signing out removes it. Old member URLs (`/member/dashboard`, `/member/account/*`, `/member/announcements`) redirect.

**Member sign-in (built, reuse it):** mobile number + SMS code, email + password (with email verification and reset), and Google all go through Firebase, then `POST /api/member/auth/session` swaps the Firebase token for a member session (`/google` is kept as an alias). The linking rules (which member a sign-in belongs to, shared family phone numbers, unverified emails) are in `server/services/memberIdentity.js` with unit tests; the UI is `src/features/member-auth/MemberAuthPanel.jsx`, and `useMemberAuth().exchangeSession` is the client call.

**Sign in with Google (own OAuth client):** with `GOOGLE_CLIENT_ID` set (server env), the sign-in panel shows Google's own button (Google Identity Services) instead of Firebase's popup. `POST /api/member/auth/google-id { credential }` verifies Google's ID token (RS256 signature against Google's published keys, audience = our client, issuer, expiry; `services/googleIdToken.js`, no client secret involved) and links by `Member.googleSub`, else by Google-verified email, else creates the member (`decideGoogleLink` in `services/memberIdentity.js`). The client's Authorized JavaScript origins must include every site the app runs on.

**Test-mode mobile sign-in:** with `DEFAULT_OTP=<4-8 digits>` (the misspelt `DEFULT_OTP` also works) the app's mobile sign-in sends no SMS and accepts that code for any number (`POST /api/member/auth/otp/request` and `/otp/verify`, `GET /api/member/auth/config` tells the app which mode is on). The phone number is matched to members exactly as in real SMS sign-in, but nothing is linked to a Firebase account. It is refused whenever `NODE_ENV=production` (`services/testOtp.js`), and the server logs a warning at startup while it's on.

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
- **Activity log (built):** `middleware/activityLog.js` records every staff POST/PUT/PATCH/DELETE after the response (who, which record, outcome, IP, device; never bodies). Readable sentences come from the `ACTIONS` table in `services/activityService.js`: **add a line there for each new staff endpoint** (unknown routes fall back to "added a widget"-style wording). The member and amount are taken from the path (`/members/:id`) or from a top-level `member`, `payment`, `refund` or `expense` object in your JSON response.
- **Permission check test:** `server/tests/routePermissions.test.js` walks every mounted router and fails if a staff route that changes data has no `requirePermission(...)`, or an `/admin` route has no `adminAuth`.
- **Staff sign-in protection (built):** every attempt is in `LoginEvent`; 5 wrong passwords in 15 minutes pause sign-in for that email (`services/staffAuthService.js`). Password rules: `passwordProblem()` in the same file.
- **Session revocation:** `User.passwordChangedAt`. `adminAuth` rejects tokens issued before it. It's set on reset, on change (`POST /api/auth/change-password` returns a fresh token for the current device) and when the owner sets a password.
- **Service worker push:** `kovij-fitness-zone/public/push-handler.js` is imported into the service worker (owned by the engagement module).
- **New settings fields:** `logoUrl`, `openingHours[{ day, closed, slots[{open, close}] }]`, `holidays[{ date, name }]`, `payments { upiId, payeeName, onlineEnabled, acceptCash, acceptUpi, acceptCard, allowPartial }`, `reminders { enabled, expiryDaysBefore[], onExpiryDay, afterExpiryDays[], paymentDue, paymentDueEveryDays, birthday, sendHour }`.

- **Installable apps (PWA):**
  - One site, one service worker, two apps:
    - **Kovij Fitness Zone** for members and website visitors (`app.webmanifest`, generated in `vite.config.js`; opens `/member/home`).
    - **Kovij Front Desk** for staff (`public/desk.webmanifest`, scope `/admin`).
  - `src/app/appIdentity.js` points `<link rel="manifest">` and the iPhone home-screen title at the right app on start-up and on every route change.
  - Install buttons use `src/app/install.js`, which captures `beforeinstallprompt`. iPhones get Add to Home Screen steps (`shared/ui/InstallApp.jsx`). They appear on the member Home and Profile and in the staff account menu.
  - Offline: member reads are cached NetworkFirst (`kv-member-api`, cleared on member sign-out) next to the staff `kv-api` cache. Queries fail at once with "You're offline" instead of waiting on a skeleton.
- **Member app passwords:**
  - Desk registration requires a date of birth, which becomes the member's first password as DDMMYYYY (`services/memberPasswordService.js`).
  - Members sign in at `POST /api/member/auth/password` with their mobile number, email or member ID. They change the password at `/password/change` (current, new, confirm), which signs out their other devices.
  - Staff reset it to the date of birth with `POST /api/admin/members/:id/app-password/reset` (the "App login" button on the profile).
  - `Member.passwordHash` is `select: false`, removed when serialising, and stripped from every Member aggregation by a pre-aggregate hook.
- **Email delivery:**
  - `services/emailService.js` sends through Gmail SMTP (`EMAIL_USER` + a 16-letter App Password in `EMAIL_PASS`), or through Brevo's HTTPS API when `BREVO_API_KEY` is set (`EMAIL_FROM` = a verified sender; `EMAIL_PROVIDER` forces one).
  - Render's free plan blocks outbound SMTP (since September 2025), so the live site needs Brevo or a paid instance.
  - Every email's real outcome is in `EmailLog`, and member notifications follow it (`notify.js` links them).
  - Owner check: Settings → Email shows the setup, last week's sent and failed counts with the latest error, and a test send.
- **ExerciseDB (built):** trainers search ExerciseDB and schedule exercises for a member on a day; members tick them off.
  - Client: `services/training/exerciseDb.js`. Only the server calls ExerciseDB. It uses the free host `https://oss.exercisedb.dev` with no key, or the paid RapidAPI host when `EXERCISEDB_RAPIDAPI_KEY` is set.
  - Endpoints used: `GET /api/v1/exercises` (`name`, `bodyParts`, `targetMuscles`, `equipments`, `exerciseTypes`, `limit` ≤ 25, cursor `after`), `GET /api/v1/exercises/{id}`, and the lists `/bodyparts`, `/muscles`, `/equipments`, `/exercisetypes` (the free host has no exercise types).
  - The free host answers 429 after about ten quick calls. The client stops calling for the `retry_after` period and serves cached answers meanwhile; users see "busy, try again in N seconds" (503 `EXERCISEDB_BUSY`, `expose: true`).
  - Cache: in memory for `EXERCISEDB_CACHE_TTL_SECONDS` (default 6 h; `0` = off), never past Monday 00:00 UTC, when ExerciseDB rotates media links. Only the exercise id and a name/muscle/equipment snapshot are stored; GIFs are always fetched live.
  - Data: `models/ExerciseAssignment.js` (one exercise, one member, one gym day; `assigned` / `completed` / `cancelled`, never deleted). Rules live in `services/training/exerciseAssignmentService.js`: trainers change only their own members' exercises; members tick off up to 7 days late, and not before the day.
  - API:
    - `/api/admin/exercisedb/*` (search, `workouts.manage`)
    - `/api/admin/exercise-assignments` (overview, member schedule and history, assign, edit, cancel, complete, reopen)
    - `/api/member/exercises` (`library/*`, `schedule`, `history`, `:id/complete`, `:id/reopen`)
  - UI:
    - Staff: Exercise library → ExerciseDB tab, `/admin/exercise-assignments`, and the member profile Workouts tab.
    - Member app: Workouts → Schedule / My plan / Explore, plus a home card.
  - The e2e suite uses a local ExerciseDB stand-in (`tests/e2e/exerciseDbStub.mjs`), never the real API.

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
